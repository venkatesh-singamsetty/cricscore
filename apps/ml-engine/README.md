# CricScore ML Engine

This directory contains the Zero-Cost MLOps pipeline for the CricScore live win predictor.

## 📁 Directory Structure

- `data/` - Drop your raw CSV files from Kaggle here (ignored by git).
- `train.py` - Script to train the win predictor model on historical data and upload it to S3.
- `predict.py` - Serverless AWS Lambda handler that downloads the model from S3 and serves live predictions.
- `requirements.txt` - Python dependencies for the ML engine.

## 🚀 How to Train Locally

1. **Get the Data:** Download a historical ball-by-ball dataset from Kaggle (e.g., IPL ball-by-ball dataset) and save it as `data/matches.csv`.
2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
3. **Run Training:**
   ```bash
   python train.py
   ```

The script will output a `win_predictor_model.joblib` file locally. In production, the GitHub Actions CI/CD pipeline will automatically run `train.py` and upload the resulting artifact to our AWS S3 bucket.
