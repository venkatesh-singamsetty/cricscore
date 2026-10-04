---
name: cricscore-mlops-standards
description: Standards for modifying, training, and deploying the CricScore Python Machine Learning models.
---

# CricScore MLOps Standards

## 1. Model Training & Artifacts

- The ML engine uses Scikit-Learn (Logistic Regression).
- Do not check `.joblib` model artifacts into source control manually unless required. The `mlops-pipeline.yml` GitHub action will train the model, test the inference, and package the artifact on PR merges.
- If you add a new predictive feature to the model, you MUST update both `live_train.py` (to compute the feature during training) and `predict.py` (to parse the feature during live API inference).

## 2. API Inference

- The ML API is served via AWS Lambda using a custom Docker container.
- If the model schema changes, ensure you bump the `modelVersion` metadata field returned in the API response so the frontend knows how to process it.
