# CricScore ML Engine

This directory contains the Zero-Cost MLOps pipeline for the CricScore live win predictor.

## 📁 Directory Structure

- `data/` - Location for processed datasets. The `data_pipeline.py` extracts Cricsheet JSONs here. (Ignored by git).
- `data_pipeline.py` - Fetches historical T20 data from Cricsheet and extracts ball-by-ball dynamic features into `live_data.csv`.
- `compare_models.py` - Multi-algorithm benchmark, MLflow tracking, quality gates, and model manifest generator.
- `predict.py` - Serverless AWS Lambda handler with safe SHA-256 loading, explicit `MODEL_VERSION` environment variable, and format-agnostic DP+DLS simulation fallback.
- `win_probability.py` - Format-agnostic ball-by-ball dynamic-programming win-probability engine (1–20 overs) accounting for required run rate, wickets remaining, and match length.
- `model_manifest.json` - Immutable release manifest with semantic version, training metadata, test evaluation metrics, and SHA-256 checksum.
- `comparison_report.md` - Generated markdown comparison table across all candidate algorithms.
- `Dockerfile` - Containerizes the model, `predict.py`, and `win_probability.py` for deployment to AWS ECR.
- `requirements.txt` - Minimal inference dependencies for the Lambda runtime container.
- `requirements-train.txt` - Dependencies for local training and CI (includes `mlflow-skinny` and `dvc`).

## 🚀 How to Train & Compare Locally

1. **Install Training Dependencies:**
   ```bash
   pip install -r requirements-train.txt
   ```
2. **Generate the Dataset (or pull via DVC):**
   ```bash
   python data_pipeline.py
   # Or using DVC:
   dvc pull
   ```
3. **Run Multi-Algorithm Comparison & MLflow Tracking:**
   ```bash
   python compare_models.py v2.1.0
   # Or using DVC reproducible pipeline:
   dvc repro
   ```

The script evaluates LogisticRegression (baseline), HistGradientBoosting, RandomForest, and ExtraTrees on match-grouped partitions (70% Train, 15% Validation, 15% Test). The winning model is persisted to `live_win_predictor_model.joblib` with an immutable `model_manifest.json` and logged to local MLflow (`mlruns/`).

## 🧪 Testing

```bash
pytest test_predict.py -v
```

## 📖 Specifications & Mathematical Documentation

- 📖 **[MLOps & Prediction Guide](../../docs/mlops_tutorial.md)**: Full pipeline docs, candidate algorithm comparison, [Win Prediction Specification](../../docs/mlops_tutorial.md#-8-win-prediction-engine-specification), and [DLS Method](../../docs/mlops_tutorial.md#️-9-duckworth-lewis-stern-dls-method).
