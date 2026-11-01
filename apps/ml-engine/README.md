# 🧠 CricScore ML Engine (Serverless MLOps & Hybrid Win Predictor)

Serverless Machine Learning & Dynamic Programming inference engine powering real-time ball-by-ball win probability (`POST /match/predict`), running within the platform's **~$1/month** AWS footprint.

---

## 🗺️ Pipeline Architecture

```mermaid
flowchart LR
    Data["Cricsheet T20 Archives + DVC"] --> Prep["data_pipeline.py (live_data.csv)"]
    Prep --> Bench["compare_models.py (8-Model Benchmark + MLflow)"]
    Bench --> Champ["XGBoost v2.2.0 (Val AUC 0.7723)"]
    Champ --> S3["S3 Model Registry (models/v2.2.0/)"]
    Champ --> ECR["ECR Image (xgboost-cpu ~309 MB, countNumber=1)"]
    S3 & ECR --> Lambda["ml-predict Lambda (XGBoost + Markov DP + DLS)"]
```

---

## 📁 Directory Inventory

| File / Folder                   | Purpose                                                                                                                                               |
| :------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/`                         | Processed `live_data.csv` dataset extracted from Cricsheet T20 archives (git-ignored; tracked via DVC)                                                |
| `data_pipeline.py`              | Extracts `786K+` ball-by-ball match states from `cricket-data/t20s_json.zip` into `data/live_data.csv`                                                |
| `compare_models.py`             | Leakage-free 8-model benchmark (7 Scikit-Learn classifiers + **XGBoost**), MLflow logger, quality gate validator, and `model_manifest.json` generator |
| `predict.py`                    | AWS Lambda container entrypoint with S3 `/tmp` caching, SHA-256 checksum verification, and hybrid **XGBoost + Markov DP + DLS** inference             |
| `win_probability.py`            | Format-agnostic (`1`–`20` overs) Markov Chain Dynamic Programming chase simulator and DLS Standard Edition resource par calculator                    |
| `projected_score_regression.py` | 1st-innings projected score regression benchmark (Linear, Polynomial, SVR, Lasso, Ridge)                                                              |
| `match_clustering.py`           | Unsupervised pitch/match condition clustering benchmark (K-Means, Agglomerative)                                                                      |
| `model_manifest.json`           | Immutable release manifest (`v2.2.0`, `XGBoost`, evaluation metrics, and `.joblib` SHA-256 hash)                                                      |
| `comparison_report.md`          | Auto-generated Markdown table comparing all 8 candidate models                                                                                        |
| `Dockerfile`                    | Builds the CPU-only (`xgboost-cpu`, `~309 MB`) Python 3.12 AWS Lambda container image                                                                 |
| `test_predict.py`               | **29** Pytest unit tests validating terminal states, DLS par alignment, shortened overs, and hybrid blending                                          |

---

## 🚀 Quickstart Commands

| Task                                      | Command                                                                                                   |
| :---------------------------------------- | :-------------------------------------------------------------------------------------------------------- |
| **1. Create training virtualenv**         | `python3 -m venv .venv-train && source .venv-train/bin/activate && pip install -r requirements-train.txt` |
| **2. Extract dataset**                    | `python data_pipeline.py`                                                                                 |
| **3. Run 8-model MLflow benchmark**       | `python compare_models.py v2.2.0` (or `dvc repro` from repo root)                                         |
| **4. Run 29 unit tests**                  | `pytest test_predict.py -v`                                                                               |
| **5. Build CPU Docker image (`~309 MB`)** | `docker build --platform linux/amd64 --provenance=false -t cricscore-ml-predict:v2.2.0 .`                 |

```bash
cd apps/ml-engine
python3 -m venv .venv-train && source .venv-train/bin/activate
pip install -r requirements-train.txt
python data_pipeline.py
python compare_models.py v2.2.0
pytest test_predict.py -v
```

---

## 📖 Deep-Dive Tutorials

- **[Serverless MLOps & DLS Tutorial](../../docs/mlops_tutorial.md)**
- **[ML Models Benchmark Handbook](../../docs/ml_models_handbook.md)**
