# CricScore ML Engine

This directory contains the Zero-Cost MLOps pipeline for the CricScore live win predictor.

## 📁 Directory Structure

- `data/` - Location for processed datasets. The `data_pipeline.py` extracts Cricsheet JSONs here. (Ignored by git).
- `data_pipeline.py` - Fetches historical T20 data from Cricsheet and extracts ball-by-ball dynamic features into `live_data.csv`.
- `live_train.py` - Script to train the live win predictor model on dynamic variables (`runs`, `wickets`, `balls_left`) and output `live_win_predictor_model.joblib`.
- `predict.py` - Serverless AWS Lambda handler that loads the joblib model from disk to serve live predictions.
- `Dockerfile` - Containerizes the model and `predict.py` for deployment to AWS ECR.
- `requirements.txt` - Python dependencies for the ML engine.

## 🚀 How to Train Locally

1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
2. **Generate the Dataset:**
   ```bash
   python data_pipeline.py
   ```
   _(This downloads and parses Cricsheet JSON files into `data/live_data.csv`)_
3. **Run Training:**
   ```bash
   python live_train.py
   ```

The script will output `live_win_predictor_model.joblib` and `live_metadata.json` locally. In production, the GitHub Actions CI/CD pipeline will automatically run these scripts, build the Docker image, and push it to the AWS ECR Private repository.

## 📖 Specifications & Mathematical Documentation

- 📖 **[MLOps & Prediction Guide](../../docs/mlops_tutorial.md)**: Full pipeline docs, [Win Prediction Specification](../../docs/mlops_tutorial.md#-8-win-prediction-engine-specification) (par-RPO scaling, RRR caps, wicket sensitivity), and [DLS Method](../../docs/mlops_tutorial.md#️-9-duckworth-lewis-stern-dls-method) (ICC resource decay, par-score calculations).
