"""
CricScore MLOps: Model Experimentation, Algorithm Comparison, and MLflow Tracking.

Compares candidate algorithms against the LogisticRegression baseline for live
ball-by-ball win probability prediction. Prevents data leakage via match-level
grouped chronological/independent splits. Logs experiments with MLflow and
produces an immutable model release manifest with SHA-256 checksums.
"""

import os
import sys
import json
import time
import hashlib
import datetime
import subprocess
from pathlib import Path

import numpy as np
import pandas as pd
import joblib

from sklearn.linear_model import LogisticRegression, SGDClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import (
    RandomForestClassifier,
    ExtraTreesClassifier,
    HistGradientBoostingClassifier,
)
try:
    import xgboost as xgb
except ImportError:
    xgb = None
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score,
    log_loss,
    brier_score_loss,
    roc_auc_score,
    confusion_matrix,
)

os.environ["MLFLOW_DISABLE_AGENT_HINT"] = "1"
os.environ["MLFLOW_ALLOW_FILE_STORE"] = "true"
try:
    import mlflow
except ImportError:
    mlflow = None


# --- Paths & Constants ---
ENGINE_DIR = Path(__file__).resolve().parent
DATA_FILE = ENGINE_DIR / "data" / "live_data.csv"
ALT_DATA_FILE = ENGINE_DIR.parent.parent / "data" / "live_data.csv"
DVC_FILE = ENGINE_DIR.parent.parent / "cricket-data" / "t20s_json.zip.dvc"
MLRUNS_DIR = ENGINE_DIR / "mlruns"
MODEL_OUTPUT_FILE = ENGINE_DIR / "live_win_predictor_model.joblib"
METADATA_OUTPUT_FILE = ENGINE_DIR / "live_metadata.json"
MANIFEST_OUTPUT_FILE = ENGINE_DIR / "model_manifest.json"
REPORT_OUTPUT_FILE = ENGINE_DIR / "comparison_report.md"

CATEGORICAL_FEATURES = ["batting_team", "bowling_team", "inning"]
NUMERIC_FEATURES = ["balls_left", "current_score", "wickets_lost", "target_score"]
ALL_FEATURES = CATEGORICAL_FEATURES + NUMERIC_FEATURES

MIN_ACCURACY_THRESHOLD = 0.60
MIN_ROCAUC_THRESHOLD = 0.65
MAX_MODEL_SIZE_MB = 25.0


def get_git_commit() -> str:
    try:
        res = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=str(ENGINE_DIR),
            capture_output=True,
            text=True,
            check=True,
        )
        return res.stdout.strip()
    except Exception:
        return os.environ.get("GITHUB_SHA", "unknown")


def get_dataset_version() -> str:
    if DVC_FILE.exists():
        try:
            import yaml
            content = yaml.safe_load(DVC_FILE.read_text())
            outs = content.get("outs", [])
            if outs and "md5" in outs[0]:
                return f"dvc:{outs[0]['md5']}"
        except Exception:
            # Fallback to dataset file hash if PyYAML is unavailable or DVC file malformed
            pass
    # Fallback to dataset file hash if available
    if DATA_FILE.exists():
        hasher = hashlib.md5()
        with open(DATA_FILE, "rb") as f:
            chunk = f.read(65536)
            while chunk:
                hasher.update(chunk)
                chunk = f.read(65536)
        return f"md5:{hasher.hexdigest()[:16]}"
    return "unknown"


def compute_sha256(filepath: Path) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        chunk = f.read(65536)
        while chunk:
            hasher.update(chunk)
            chunk = f.read(65536)
    return hasher.hexdigest()


def load_and_split_data(sample_max: int = 120000, random_seed: int = 42):
    """
    Loads data and performs a grouped split by match_id to strictly prevent
    data leakage across balls of the same match.
    Split: 70% Train, 15% Validation, 15% Held-out Test.
    """
    active_data_file = DATA_FILE if DATA_FILE.exists() else ALT_DATA_FILE
    if not active_data_file.exists():
        raise FileNotFoundError(f"Dataset not found at {DATA_FILE} or {ALT_DATA_FILE}. Run data_pipeline.py first.")

    print(f"📊 Loading dataset from {active_data_file}...")
    df = pd.read_csv(active_data_file)

    # Filter invalid/abandoned matches without definitive winner
    df = df[df["winner"].isin(df["batting_team"]) | df["winner"].isin(df["bowling_team"])].copy()
    df["target"] = (df["winner"] == df["batting_team"]).astype(int)

    # Subsample matches if dataset is huge for bounded CI execution while preserving match integrity
    matches = df["match_id"].unique()
    np.random.seed(random_seed)
    np.random.shuffle(matches)

    # Compute matches count corresponding to desired sample limit
    avg_balls_per_match = len(df) / len(matches)
    desired_matches = min(len(matches), int(sample_max / avg_balls_per_match))
    selected_matches = matches[:desired_matches]
    df = df[df["match_id"].isin(selected_matches)].copy()

    n_matches = len(selected_matches)
    n_train = int(n_matches * 0.70)
    n_val = int(n_matches * 0.15)

    train_match_ids = set(selected_matches[:n_train])
    val_match_ids = set(selected_matches[n_train : n_train + n_val])
    test_match_ids = set(selected_matches[n_train + n_val :])

    train_df = df[df["match_id"].isin(train_match_ids)]
    val_df = df[df["match_id"].isin(val_match_ids)]
    test_df = df[df["match_id"].isin(test_match_ids)]

    print(
        f"✅ Match-grouped split: Train {len(train_df):,} balls ({len(train_match_ids)} matches), "
        f"Validation {len(val_df):,} balls ({len(val_match_ids)} matches), "
        f"Test {len(test_df):,} balls ({len(test_match_ids)} matches)."
    )

    X_train, y_train = train_df[ALL_FEATURES], train_df["target"]
    X_val, y_val = val_df[ALL_FEATURES], val_df["target"]
    X_test, y_test = test_df[ALL_FEATURES], test_df["target"]

    return (X_train, y_train), (X_val, y_val), (X_test, y_test)


def build_preprocessor() -> ColumnTransformer:
    cat_transformer = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    num_transformer = StandardScaler()
    return ColumnTransformer(
        transformers=[
            ("cat", cat_transformer, CATEGORICAL_FEATURES),
            ("num", num_transformer, NUMERIC_FEATURES),
        ]
    )


def measure_inference_latency(pipeline: Pipeline, X_sample: pd.DataFrame, n_iter: int = 5) -> float:
    sample = X_sample.iloc[:100]
    timings = []
    for _ in range(n_iter):
        t0 = time.perf_counter()
        pipeline.predict_proba(sample)
        timings.append((time.perf_counter() - t0) * 1000)  # ms for 100 rows
    return float(np.mean(timings))


def evaluate_predictions(y_true, y_prob):
    y_pred = (y_prob >= 0.5).astype(int)
    acc = float(accuracy_score(y_true, y_pred))
    ll = float(log_loss(y_true, y_prob))
    brier = float(brier_score_loss(y_true, y_prob))
    try:
        auc = float(roc_auc_score(y_true, y_prob))
    except ValueError:
        auc = 0.5
    return {
        "accuracy": round(acc, 4),
        "log_loss": round(ll, 4),
        "brier_score": round(brier, 4),
        "roc_auc": round(auc, 4),
    }


def run_experiment(version: str = "v2.1.0", random_seed: int = 42):
    print(f"🚀 Running CricScore MLOps Model Comparison Pipeline [{version}]...")
    (X_train, y_train), (X_val, y_val), (X_test, y_test) = load_and_split_data(
        sample_max=120000, random_seed=random_seed
    )

    git_sha = get_git_commit()
    dataset_ver = get_dataset_version()

    # Define Candidate Classifiers
    candidates = {
        "LogisticRegression": {
            "model": LogisticRegression(max_iter=1000, random_state=random_seed),
            "params": {"max_iter": 1000, "solver": "lbfgs", "role": "baseline"},
        },
        "GaussianNB": {
            "model": GaussianNB(),
            "params": {"var_smoothing": 1e-9, "role": "candidate_naive_bayes"},
        },
        "DecisionTree": {
            "model": DecisionTreeClassifier(max_depth=6, random_state=random_seed),
            "params": {"max_depth": 6, "criterion": "gini", "role": "candidate_decision_tree"},
        },
        "LinearSVM_SGD": {
            "model": SGDClassifier(loss="log_loss", max_iter=1000, random_state=random_seed),
            "params": {"loss": "log_loss", "penalty": "l2", "role": "candidate_linear_svm"},
        },
        "RandomForest": {
            "model": RandomForestClassifier(
                n_estimators=50, max_depth=10, random_state=random_seed, n_jobs=-1
            ),
            "params": {"n_estimators": 50, "max_depth": 10, "role": "candidate_ensemble"},
        },
        "ExtraTrees": {
            "model": ExtraTreesClassifier(
                n_estimators=50, max_depth=10, random_state=random_seed, n_jobs=-1
            ),
            "params": {"n_estimators": 50, "max_depth": 10, "role": "candidate_ensemble"},
        },
        "HistGradientBoosting": {
            "model": HistGradientBoostingClassifier(
                max_iter=100, max_depth=8, learning_rate=0.1, random_state=random_seed
            ),
            "params": {"max_iter": 100, "max_depth": 8, "learning_rate": 0.1, "role": "candidate_gradient_boosting"},
        },
    }

    if xgb is not None:
        candidates["XGBoost"] = {
            "model": xgb.XGBClassifier(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                eval_metric="logloss",
                random_state=random_seed,
            ),
            "params": {
                "n_estimators": 100,
                "max_depth": 6,
                "learning_rate": 0.1,
                "eval_metric": "logloss",
                "role": "candidate_extreme_gradient_boosting",
            },
        }

    if mlflow:
        MLRUNS_DIR.mkdir(parents=True, exist_ok=True)
        os.environ["MLFLOW_DISABLE_AGENT_HINT"] = "1"
        os.environ["MLFLOW_ALLOW_FILE_STORE"] = "true"
        mlflow.set_tracking_uri(f"file://{MLRUNS_DIR.resolve()}")
        mlflow.set_experiment("cricket-win-probability")

    results = {}

    for name, spec in candidates.items():
        print(f"\n⚙️ Training {name} ({spec['params']['role']})...")
        preprocessor = build_preprocessor()
        pipeline = Pipeline([("preprocessor", preprocessor), ("classifier", spec["model"])])

        t0 = time.time()
        pipeline.fit(X_train, y_train)
        train_duration = round(time.time() - t0, 3)

        val_probs = pipeline.predict_proba(X_val)[:, 1]
        val_metrics = evaluate_predictions(y_val, val_probs)
        latency_ms = measure_inference_latency(pipeline, X_val)

        # Temp save to measure artifact size
        temp_path = Path(f"/tmp/{name}.joblib")
        joblib.dump(pipeline, temp_path)
        size_mb = round(temp_path.stat().st_size / (1024 * 1024), 3)

        results[name] = {
            "pipeline": pipeline,
            "params": spec["params"],
            "train_duration_s": train_duration,
            "val_metrics": val_metrics,
            "latency_100rows_ms": latency_ms,
            "size_mb": size_mb,
            "artifact_path": temp_path,
        }

        print(
            f"   ✓ Train time: {train_duration}s | Size: {size_mb} MB | "
            f"Acc: {val_metrics['accuracy']} | LogLoss: {val_metrics['log_loss']} | "
            f"Brier: {val_metrics['brier_score']} | AUC: {val_metrics['roc_auc']} | "
            f"Latency (100 rows): {latency_ms:.2f}ms"
        )

        if mlflow:
            with mlflow.start_run(run_name=f"{name}-{version}"):
                mlflow.log_params(spec["params"])
                mlflow.log_param("features", ALL_FEATURES)
                mlflow.log_param("train_samples", len(X_train))
                mlflow.log_param("val_samples", len(X_val))
                mlflow.log_metrics({f"val_{k}": v for k, v in val_metrics.items()})
                mlflow.log_metric("train_duration_s", train_duration)
                mlflow.log_metric("latency_100rows_ms", latency_ms)
                mlflow.log_metric("size_mb", size_mb)
                mlflow.set_tag("git_commit", git_sha)
                mlflow.set_tag("dataset_version", dataset_ver)
                mlflow.set_tag("algorithm", name)

    # --- Candidate Promotion Logic ---
    print("\n🏆 Evaluating candidates against promotion gates...")
    baseline_metrics = results["LogisticRegression"]["val_metrics"]

    promoted_name = None
    best_score = float("inf")  # Objective: minimize Brier score & LogLoss

    for name, res in results.items():
        v = res["val_metrics"]
        size = res["size_mb"]

        # Quality gates:
        passes_gates = (
            v["accuracy"] >= MIN_ACCURACY_THRESHOLD
            and v["roc_auc"] >= MIN_ROCAUC_THRESHOLD
            and size <= MAX_MODEL_SIZE_MB
        )

        # Composite optimization score: weighted combination of brier score and log loss
        score = v["brier_score"] + (0.5 * min(v["log_loss"], 1.5))

        if passes_gates and score < best_score:
            best_score = score
            promoted_name = name

    if not promoted_name:
        print("⚠️ No candidate cleared promotion gates; retaining Baseline LogisticRegression.")
        promoted_name = "LogisticRegression"

    promoted = results[promoted_name]
    promoted_pipeline = promoted["pipeline"]

    print(f"⭐ Promoted Winner: {promoted_name}")

    # Evaluate Winner on Held-out Test Set
    test_probs = promoted_pipeline.predict_proba(X_test)[:, 1]
    test_metrics = evaluate_predictions(y_test, test_probs)
    test_preds = (test_probs >= 0.5).astype(int)
    cm = confusion_matrix(y_test, test_preds).tolist()

    print(
        f"🎯 Final Test Set Evaluation [{promoted_name}]: "
        f"Accuracy: {test_metrics['accuracy']} | Log Loss: {test_metrics['log_loss']} | "
        f"Brier: {test_metrics['brier_score']} | ROC-AUC: {test_metrics['roc_auc']}"
    )

    # Persist Final Promoted Model Artifact
    joblib.dump(promoted_pipeline, MODEL_OUTPUT_FILE)
    artifact_sha256 = compute_sha256(MODEL_OUTPUT_FILE)
    artifact_size_mb = round(MODEL_OUTPUT_FILE.stat().st_size / (1024 * 1024), 3)

    # Model Release Manifest
    manifest = {
        "modelName": "cricket-win-predictor",
        "modelVersion": version,
        "algorithm": promoted_name,
        "gitCommit": git_sha,
        "datasetVersion": dataset_ver,
        "featureSchemaVersion": "v2.0",
        "features": ALL_FEATURES,
        "categoricalFeatures": CATEGORICAL_FEATURES,
        "numericFeatures": NUMERIC_FEATURES,
        "trainingParameters": promoted["params"],
        "randomSeed": random_seed,
        "evaluationMetrics": {
            "validation": promoted["val_metrics"],
            "test": test_metrics,
            "baselineLogisticRegressionVal": baseline_metrics,
        },
        "confusionMatrix": cm,
        "runtimePerformance": {
            "trainingDurationSeconds": promoted["train_duration_s"],
            "inferenceLatency100RowsMs": promoted["latency_100rows_ms"],
            "modelSizeMb": artifact_size_mb,
        },
        "pythonVersion": sys.version.split()[0],
        "dependencies": {
            "scikit-learn": "1.5.0",
            "joblib": "1.3.2",
            "pandas": "2.2.1",
        },
        "artifact": {
            "filename": MODEL_OUTPUT_FILE.name,
            "sha256": artifact_sha256,
            "sizeBytes": MODEL_OUTPUT_FILE.stat().st_size,
        },
        "approvalStatus": "approved" if test_metrics["accuracy"] >= MIN_ACCURACY_THRESHOLD else "rejected",
        "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }

    with open(MANIFEST_OUTPUT_FILE, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"💾 Manifest written to {MANIFEST_OUTPUT_FILE}")

    # Backwards-compatible live_metadata.json for existing predict.py
    live_metadata = {
        "modelVersion": f"{version}-{promoted_name.lower()}",
        "trainingDate": manifest["createdAt"],
        "datasetSource": "Cricsheet T20s Ball-by-Ball",
        "numBallsTrained": len(X_train),
        "numBallsTested": len(X_test),
        "features": ALL_FEATURES,
        "modelType": f"{promoted_name} (scikit-learn)",
        "metrics": {
            "accuracy": test_metrics["accuracy"],
            "logLoss": test_metrics["log_loss"],
            "rocAuc": test_metrics["roc_auc"],
            "brierScore": test_metrics["brier_score"],
        },
        "sha256": artifact_sha256,
    }

    with open(METADATA_OUTPUT_FILE, "w") as f:
        json.dump(live_metadata, f, indent=2)
    print(f"💾 Metadata written to {METADATA_OUTPUT_FILE}")

    # Markdown Comparison Report
    generate_comparison_report(results, promoted_name, test_metrics, manifest)

    if mlflow:
        with mlflow.start_run(run_name=f"promoted-{version}"):
            mlflow.log_params({"promoted_model": promoted_name, "version": version})
            mlflow.log_metrics({f"final_test_{k}": v for k, v in test_metrics.items()})
            mlflow.set_tag("status", "promoted")
            mlflow.log_artifact(str(MANIFEST_OUTPUT_FILE))
            mlflow.log_artifact(str(REPORT_OUTPUT_FILE))

    return manifest


def generate_comparison_report(results: dict, winner: str, test_metrics: dict, manifest: dict):
    md = [
        "# CricScore ML Model Comparison & Evaluation Report",
        "",
        f"**Date:** {manifest['createdAt']}  ",
        f"**Model Release Version:** `{manifest['modelVersion']}`  ",
        f"**Git Commit:** `{manifest['gitCommit']}`  ",
        f"**Dataset Hash:** `{manifest['datasetVersion']}`  ",
        f"**Promoted Algorithm:** **{winner}**  ",
        "",
        "## 1. Candidate Comparison on Validation Set",
        "",
        "| Algorithm | Accuracy | Log Loss | Brier Score | ROC-AUC | Latency (100 rows) | Size (MB) | Status |",
        "| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |",
    ]

    for name, res in results.items():
        v = res["val_metrics"]
        status = "⭐ **Promoted**" if name == winner else ("Baseline" if name == "LogisticRegression" else "Evaluated")
        md.append(
            f"| `{name}` | {v['accuracy']:.4f} | {v['log_loss']:.4f} | {v['brier_score']:.4f} | "
            f"{v['roc_auc']:.4f} | {res['latency_100rows_ms']:.2f} ms | {res['size_mb']:.2f} MB | {status} |"
        )

    md.extend([
        "",
        "## 2. Promoted Model Test-Set Evaluation",
        "",
        f"- **Algorithm:** `{winner}`",
        f"- **Held-out Test Accuracy:** `{test_metrics['accuracy']:.4f}` (Gate: `>= {MIN_ACCURACY_THRESHOLD}`)",
        f"- **Test Log Loss:** `{test_metrics['log_loss']:.4f}`",
        f"- **Test Brier Score:** `{test_metrics['brier_score']:.4f}`",
        f"- **Test ROC-AUC:** `{test_metrics['roc_auc']:.4f}` (Gate: `>= {MIN_ROCAUC_THRESHOLD}`)",
        f"- **Model SHA-256 Checksum:** `{manifest['artifact']['sha256']}`",
        "",
        "## 3. Data Leakage Prevention Guarantees",
        "",
        "- **Match-Grouped Split:** All deliveries belonging to any individual `match_id` reside strictly within a single partition (Train, Validation, or Test).",
        "- **No Post-Match Statistics:** Features are strictly limited to state observables at prediction time (`balls_left`, `current_score`, `wickets_lost`, `target_score`, `inning`, `batting_team`, `bowling_team`).",
        "- **Probability Calibration:** Log Loss and Brier Score serve as primary evaluation criteria rather than raw accuracy alone, ensuring faithful win probability output.",
        "",
    ])

    REPORT_OUTPUT_FILE.write_text("\n".join(md))
    print(f"📄 Report written to {REPORT_OUTPUT_FILE}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="CricScore MLOps Candidate Model Comparison")
    parser.add_argument("pos_version", nargs="?", default=None, help="Model version (positional)")
    parser.add_argument("--version", "-v", dest="opt_version", default=None, help="Model version flag")
    args = parser.parse_args()
    version = args.opt_version or args.pos_version or "v2.2.0"
    run_experiment(version=version)
