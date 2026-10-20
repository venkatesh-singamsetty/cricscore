# CricScore ML Model Comparison & Evaluation Report

**Date:** 2026-10-20T04:12:06.260254+00:00  
**Model Release Version:** `v2.2.0`  
**Git Commit:** `07817d15b96e0127f9c580a81c0704406366fca8`  
**Dataset Hash:** `dvc:31e19c47bdbc05d773938754d8589516`  
**Promoted Algorithm:** **XGBoost**

## 1. Candidate Comparison on Validation Set

| Algorithm              | Accuracy | Log Loss | Brier Score | ROC-AUC | Latency (100 rows) | Size (MB) |     Status      |
| :--------------------- | :------: | :------: | :---------: | :-----: | :----------------: | :-------: | :-------------: |
| `LogisticRegression`   |  0.6559  |  0.8069  |   0.2379    | 0.7550  |      1.52 ms       |  0.01 MB  |    Baseline     |
| `GaussianNB`           |  0.6436  |  9.5548  |   0.3515    | 0.6487  |      1.81 ms       |  0.01 MB  |    Evaluated    |
| `DecisionTree`         |  0.6998  |  0.8488  |   0.2014    | 0.7558  |      1.19 ms       |  0.01 MB  |    Evaluated    |
| `LinearSVM_SGD`        |  0.6755  |  0.6526  |   0.2148    | 0.7704  |      1.32 ms       |  0.01 MB  |    Evaluated    |
| `RandomForest`         |  0.6819  |  0.6136  |   0.2119    | 0.7561  |      15.38 ms      |  0.70 MB  |    Evaluated    |
| `ExtraTrees`           |  0.6667  |  0.6532  |   0.2302    | 0.7118  |      14.96 ms      |  0.71 MB  |    Evaluated    |
| `HistGradientBoosting` |  0.6789  |  0.5998  |   0.2063    | 0.7642  |      3.84 ms       |  0.37 MB  |    Evaluated    |
| `XGBoost`              |  0.6835  |  0.5786  |   0.1992    | 0.7723  |      1.98 ms       |  0.22 MB  | ⭐ **Promoted** |

## 2. Promoted Model Test-Set Evaluation

- **Algorithm:** `XGBoost`
- **Held-out Test Accuracy:** `0.6901` (Gate: `>= 0.6`)
- **Test Log Loss:** `0.6018`
- **Test Brier Score:** `0.2060`
- **Test ROC-AUC:** `0.7529` (Gate: `>= 0.65`)
- **Model SHA-256 Checksum:** `de9e39513fbac895df7c86c449ef0a6b687717b5d1f40af08b5a5b13aa37c0cf`

## 3. Data Leakage Prevention Guarantees

- **Match-Grouped Split:** All deliveries belonging to any individual `match_id` reside strictly within a single partition (Train, Validation, or Test).
- **No Post-Match Statistics:** Features are strictly limited to state observables at prediction time (`balls_left`, `current_score`, `wickets_lost`, `target_score`, `inning`, `batting_team`, `bowling_team`).
- **Probability Calibration:** Log Loss and Brier Score serve as primary evaluation criteria rather than raw accuracy alone, ensuring faithful win probability output.
