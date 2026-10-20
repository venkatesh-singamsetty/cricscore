---
name: cricscore-mlops-standards
description: Use when changing CricScore win-prediction features, Python training or inference, model artifacts, or the ML GitHub Actions workflow.
---

# CricScore MLOps Standards

Refer to `docs/mlops_tutorial.md`, `docs/ml_models_handbook.md`, `apps/ml-engine/predict.py`, `apps/ml-engine/compare_models.py`, `apps/ml-engine/win_probability.py`, and `.github/workflows/mlops-pipeline.yml`.

## 1. Multi-Algorithm Benchmarking & XGBoost Champion

- **Champion Architecture (`v2.2.0-xgboost`)**:
  - Live prediction Lambda uses **XGBoost** (`XGBClassifier`) blended with Markov Dynamic Programming (DP) and DLS resource par simulation.
  - Multi-model evaluation in `compare_models.py` benchmarks 8 classification models on match-grouped splits (70% train, 15% validation, 15% test) to prevent target leakage.
  - Quality gates: Validation Accuracy $\ge 0.60$, ROC-AUC $\ge 0.65$, Model Size $\le 25\text{MB}$.
  - Experiment tracking logged via local MLflow (`mlruns/`) and DVC dataset tracking (`cricket-data/t20s_json.zip.dvc`).
  - Model artifacts are released with an immutable `model_manifest.json` featuring SHA-256 checksums verified by Lambda on cold start before deserialization.

## 2. Classical Machine Learning Suite

- **1st-Innings Projected Score Regression (`apps/ml-engine/projected_score_regression.py`)**:
  - Benchmarks 5 classical regression models (Simple Linear, Polynomial degree 2, SVR, Lasso L1, Ridge L2) on predicting final 1st-innings total runs.
- **Match Condition & Scoring Archetype Clustering (`apps/ml-engine/match_clustering.py`)**:
  - Evaluates K-Means ($k=3$) and Hierarchical Agglomerative clustering on completed match innings to discover pitch archetypes (Batting Paradise, Bowling Minefield, Balanced Competitive).
- **ML Models Revision Handbook (`docs/ml_models_handbook.md`)**:
  - Educational reference covering all 14 classical ML models with math foundations, cricket domain mappings, and interview cheat sheets.

## 3. Hybrid Ball-by-Ball DP + DLS Win Probability Engine

- **Format-Agnostic Architecture (1–20 Overs)**:
  - Inference runs in `apps/ml-engine/predict.py` backed by `apps/ml-engine/win_probability.py` (`compute_win_probability`, `modelVersion: "v2.2.0+dp-sim"`).
  - Never hardcode 20 overs (`120` balls); always derive total match balls from `ballsBowled + ballsLeft` or `totalOvers * 6`.
- **1st Innings Projection**:
  - Projects expected final 1st-innings total from current runs, run-rate momentum, remaining balls, and wickets in hand, then compares against format-scaled par ($8.0 \times \text{totalOvers}$) via a logistic curve.
  - Before the first ball (`ballsBowled == 0, currentScore == 0, wicketsLost == 0`), always return an exact `0.5 / 0.5` (`Balanced (50-50)`) baseline.
- **2nd Innings Chase (DP + DLS Hybrid)**:
  - Enforces deterministic terminal conditions first:
    - `runsNeeded <= 0` -> `1.0` (batting team won)
    - `ballsLeft <= 0` or `wicketsLost >= 10` or `runsNeeded > ballsLeft * 6` -> `0.0` (bowling team won / mathematically impossible)
  - Blends exact ball-by-ball Markov Dynamic Programming (`_chase_win_prob_dp`) with format-normalized DLS resource par (`_dls_resource_remaining` matching `apps/frontend/src/utils/dlsUtils.ts`) when the required run rate is physically achievable ($\le 2.3$ runs/ball full weight, tapering linearly to `0.0` at $3.0$ runs/ball).

## 4. Container Packaging & Terraform Deployment

- **`apps/ml-engine/Dockerfile`**: Uses `public.ecr.aws/lambda/python:3.12`. Upgrades pip (`RUN pip install --upgrade pip && pip install --no-cache-dir -r requirements.txt`) to select pre-compiled Linux x86_64 binary wheels for XGBoost. Copies `predict.py`, `win_probability.py`, `live_win_predictor_model.joblib`, `live_metadata.json`, and `model_manifest.json` into `${LAMBDA_TASK_ROOT}`.
- **`infra/terraform/lambda.tf` (`null_resource.docker_build_push`)**: Hashes all files in `apps/ml-engine/*` (`dir_sha1`), builds `--platform linux/amd64 --provenance=false`, pushes to ECR (`${var.project_name}-ml-predict:latest`), and updates the Lambda function code.
- **Git Hygiene**: Never commit `apps/ml-engine/__pycache__/`, `*.pyc`, or `apps/ml-engine/venv/`.

## 5. Validation

- Run `./apps/ml-engine/venv/bin/pytest apps/ml-engine/test_predict.py` and verify all 24 tests pass before pushing.
