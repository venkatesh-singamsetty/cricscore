# CricScore ML Engine

This directory contains the Zero-Cost MLOps pipeline for the CricScore live win predictor.

## 📁 Directory Structure

- `data/` - Location for processed datasets. The `data_pipeline.py` extracts Cricsheet JSONs here. (Ignored by git).
- `data_pipeline.py` - Fetches historical T20 data from Cricsheet and extracts ball-by-ball dynamic features into `live_data.csv`.
- `live_train.py` - Script to train the live win predictor model on dynamic variables (`runs`, `wickets`, `balls_left`) and output `live_win_predictor_model.joblib`.
- `predict.py` - Serverless AWS Lambda handler that blends exact ball-by-ball dynamic-programming win probability (`win_probability.py`) with the T20-trained model so predictions are calibrated across any match length (1 to 20 overs).
- `win_probability.py` - Format-agnostic ball-by-ball dynamic-programming win-probability engine (1–20 overs) accounting for required run rate, wickets remaining, and match length.
- `Dockerfile` - Containerizes the model, `predict.py`, and `win_probability.py` for deployment to AWS ECR.
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

The script will output `live_win_predictor_model.joblib` and `live_metadata.json` locally. The GitHub Actions MLOps workflow runs the tests, downloads and parses data, trains the model, checks its accuracy threshold, and uploads the model and metadata as a workflow artifact. It does not build or push a Docker image to ECR.

## 📖 Specifications & Mathematical Documentation

- 📖 **[MLOps & Prediction Guide](../../docs/mlops_tutorial.md)**: Full pipeline docs, [Win Prediction Specification](../../docs/mlops_tutorial.md#-8-win-prediction-engine-specification) (par-RPO scaling, RRR caps, wicket sensitivity), and [DLS Method](../../docs/mlops_tutorial.md#️-9-duckworth-lewis-stern-dls-method) (ICC resource decay, par-score calculations).
