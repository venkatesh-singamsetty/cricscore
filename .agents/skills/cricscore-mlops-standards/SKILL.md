---
name: cricscore-mlops-standards
description: Use when changing CricScore win-prediction features, Python training or inference, model artifacts, or the ML GitHub Actions workflow.
---

# CricScore MLOps Standards

Refer to `docs/mlops_tutorial.md`, `apps/ml-engine/predict.py`, `apps/ml-engine/win_probability.py`, and `.github/workflows/mlops-pipeline.yml`.

## 1. Hybrid Ball-by-Ball DP + DLS Win Probability Engine

- **Format-Agnostic Architecture (1–20 Overs)**:
  - Inference runs in `apps/ml-engine/predict.py` backed by `apps/ml-engine/win_probability.py` (`compute_win_probability`, `modelVersion: "v2+dp-sim"`).
  - Never hardcode 20 overs (`120` balls); always derive total match balls from `ballsBowled + ballsLeft` or `totalOvers * 6`.
- **1st Innings Projection**:
  - Projects expected final 1st-innings total from current runs, run-rate momentum, remaining balls, and wickets in hand, then compares against format-scaled par ($8.0 \times \text{totalOvers}$) via a logistic curve.
  - Before the first ball (`ballsBowled == 0, currentScore == 0, wicketsLost == 0`), always return an exact `0.5 / 0.5` (`Balanced (50-50)`) baseline.
- **2nd Innings Chase (DP + DLS Hybrid)**:
  - Enforces deterministic terminal conditions first:
    - `runsNeeded <= 0` -> `1.0` (batting team won)
    - `ballsLeft <= 0` or `wicketsLost >= 10` or `runsNeeded > ballsLeft * 6` -> `0.0` (bowling team won / mathematically impossible)
  - Blends exact ball-by-ball Markov Dynamic Programming (`_chase_win_prob_dp`) with format-normalized DLS resource par (`_dls_resource_remaining` matching `apps/frontend/src/utils/dlsUtils.ts`) when the required run rate is physically achievable ($\le 2.3$ runs/ball full weight, tapering linearly to `0.0` at $3.0$ runs/ball).

## 2. Container Packaging & Terraform Deployment

- **`apps/ml-engine/Dockerfile`**: Must copy `predict.py`, `win_probability.py`, and `model.joblib` into `${LAMBDA_TASK_ROOT}` using `public.ecr.aws/lambda/python:3.12`.
- **`infra/terraform/lambda.tf` (`null_resource.docker_build_push`)**: Hashes all files in `apps/ml-engine/*` (`dir_sha1`), builds `--platform linux/amd64 --provenance=false`, pushes to ECR (`${var.project_name}-ml-predict:latest`), and runs `aws lambda update-function-code` + `aws lambda wait function-updated` on `${var.project_name}-ml-predict`.
- **Git Hygiene**: Never commit `apps/ml-engine/__pycache__/`, `*.pyc`, or `apps/ml-engine/venv/` (since `fileset` in `lambda.tf` hashes top-level files in `apps/ml-engine`).

## 3. Validation

- Run `./apps/ml-engine/venv/bin/pytest apps/ml-engine/test_predict.py` (or `python3 -m pytest apps/ml-engine/test_predict.py`) and verify all 1-over, 5-over, 20-over, DLS-ahead, and boundary tests pass before pushing.
