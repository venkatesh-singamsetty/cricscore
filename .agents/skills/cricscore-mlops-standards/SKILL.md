---
name: cricscore-mlops-standards
description: Use when changing CricScore win-prediction features, Python training or inference, model artifacts, or the ML GitHub Actions workflow.
---

# CricScore MLOps Standards

## Training and inference compatibility

- Keep feature names, ordering, preprocessing, and expected values consistent between `apps/ml-engine/live_train.py` and `apps/ml-engine/predict.py`. Update both and add inference tests when model inputs change.
- Do not commit generated model or data artifacts unless the deployment design explicitly requires a tracked artifact. Check `.github/workflows/mlops-pipeline.yml` and `apps/ml-engine/README.md` for the current training, artifact, and release behavior before making claims about automation.
- Keep API request/response fields compatible with the prediction Lambda and frontend consumer. If response semantics or model metadata change, update both sides and their tests.

## Validation

Run `cd apps/ml-engine && python -m pytest test_predict.py` for inference tests. For model or feature changes, also test data preparation/training assumptions and inspect the workflow that packages the model.
