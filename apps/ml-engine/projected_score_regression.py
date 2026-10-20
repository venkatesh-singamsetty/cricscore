"""
CricScore MLOps: 1st-Innings Projected Score Regression Benchmark.

Evaluates 5 classical regression models for predicting final 1st-innings total score:
1. Simple Linear Regression (SLR)
2. Polynomial Regression (Degree 2)
3. Support Vector Regression (LinearSVR / SVR)
4. Lasso Regression (L1 Regularization)
5. Ridge Regression (L2 Regularization)

Metrics evaluated: RMSE (Root Mean Squared Error), MAE (Mean Absolute Error), R² Score.
"""

import time
from pathlib import Path
import numpy as np
import pandas as pd

from sklearn.linear_model import LinearRegression, Lasso, Ridge
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from sklearn.svm import LinearSVR
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

ENGINE_DIR = Path(__file__).resolve().parent
DATA_FILE = ENGINE_DIR / "data" / "live_data.csv"


def prepare_regression_data(sample_max: int = 50000, random_seed: int = 42):
    """
    Extracts 1st-innings ball states with their actual final innings score as target.
    Features: current_score, balls_bowled, wickets_lost, run_rate_current.
    Target: final_innings_score.
    """
    if not DATA_FILE.exists():
        raise FileNotFoundError(f"Dataset not found at {DATA_FILE}")

    df = pd.read_csv(DATA_FILE)
    df_inn1 = df[df["inning"] == 1].copy()

    # Determine final innings score per match
    final_scores = df_inn1.groupby("match_id")["current_score"].max().rename("final_innings_score")
    df_inn1 = df_inn1.join(final_scores, on="match_id")

    df_inn1["balls_bowled"] = 120 - df_inn1["balls_left"]
    # Filter valid match progression (after at least 1 over bowled, before end of innings)
    df_inn1 = df_inn1[(df_inn1["balls_bowled"] >= 6) & (df_inn1["balls_left"] > 0)].copy()

    # Add feature: current run rate
    df_inn1["current_run_rate"] = (df_inn1["current_score"] / df_inn1["balls_bowled"]) * 6.0

    features = ["current_score", "balls_bowled", "balls_left", "wickets_lost", "current_run_rate"]
    target = "final_innings_score"

    match_ids = df_inn1["match_id"].unique()
    np.random.seed(random_seed)
    np.random.shuffle(match_ids)

    n_train = int(len(match_ids) * 0.70)
    train_ids = set(match_ids[:n_train])
    test_ids = set(match_ids[n_train:])

    train_mask = df_inn1["match_id"].isin(train_ids)
    test_mask = df_inn1["match_id"].isin(test_ids)

    X_train = df_inn1.loc[train_mask, features]
    y_train = df_inn1.loc[train_mask, target]
    X_test = df_inn1.loc[test_mask, features]
    y_test = df_inn1.loc[test_mask, target]

    if len(X_train) > sample_max:
        idx = np.random.choice(len(X_train), sample_max, replace=False)
        X_train = X_train.iloc[idx]
        y_train = y_train.iloc[idx]

    return (X_train, y_train), (X_test, y_test)


def run_regression_comparison():
    print("📈 Running CricScore 1st-Innings Projected Score Regression Benchmark...")
    (X_train, y_train), (X_test, y_test) = prepare_regression_data()
    print(f"📊 Dataset: {len(X_train):,} training balls | {len(X_test):,} test balls.")

    models = {
        "SimpleLinearRegression": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", LinearRegression()),
        ]),
        "PolynomialRegression_d2": Pipeline([
            ("poly", PolynomialFeatures(degree=2, include_bias=False)),
            ("scaler", StandardScaler()),
            ("regressor", LinearRegression()),
        ]),
        "SupportVectorRegression": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", LinearSVR(max_iter=2000, random_state=42, dual="auto")),
        ]),
        "Lasso_L1": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", Lasso(alpha=0.5, random_state=42)),
        ]),
        "Ridge_L2": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", Ridge(alpha=1.0, random_state=42)),
        ]),
    }

    results = []
    print("\n" + "=" * 80)
    print(f"{'Regression Model':28} | {'RMSE (runs)':12} | {'MAE (runs)':12} | {'R² Score':10} | {'Train Time':10}")
    print("=" * 80)

    for name, pipe in models.items():
        t0 = time.perf_counter()
        pipe.fit(X_train, y_train)
        duration = time.perf_counter() - t0

        preds = pipe.predict(X_test)
        rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
        mae = float(mean_absolute_error(y_test, preds))
        r2 = float(r2_score(y_test, preds))

        print(f"{name:28} | {rmse:12.2f} | {mae:12.2f} | {r2:10.4f} | {duration:8.3f}s")
        results.append({
            "model": name,
            "rmse": round(rmse, 2),
            "mae": round(mae, 2),
            "r2": round(r2, 4),
            "train_duration_s": round(duration, 3),
        })

    print("=" * 80)
    return results


if __name__ == "__main__":
    run_regression_comparison()
