# CricScore ML Model Comparison & Evaluation Report

**Date:** 2026-10-20T02:53:16.723897+00:00  
**Model Release Version:** `v2.1.0`  
**Git Commit:** `3197f01d020941b0d15146fe54b1a0b6b8b61b72`  
**Dataset Hash:** `dvc:31e19c47bdbc05d773938754d8589516`  
**Promoted Algorithm:** **HistGradientBoosting**

## 1. Candidate Comparison on Validation Set

| Algorithm              | Accuracy | Log Loss | Brier Score | ROC-AUC | Latency (100 rows) | Size (MB) |     Status      |
| :--------------------- | :------: | :------: | :---------: | :-----: | :----------------: | :-------: | :-------------: |
| `LogisticRegression`   |  0.6559  |  0.8069  |   0.2379    | 0.7550  |      1.37 ms       |  0.01 MB  |    Baseline     |
| `HistGradientBoosting` |  0.6789  |  0.5998  |   0.2063    | 0.7642  |      5.98 ms       |  0.37 MB  | ⭐ **Promoted** |
| `RandomForest`         |  0.6819  |  0.6136  |   0.2119    | 0.7561  |      14.33 ms      |  0.70 MB  |    Evaluated    |
| `ExtraTrees`           |  0.6667  |  0.6532  |   0.2302    | 0.7118  |      15.08 ms      |  0.71 MB  |    Evaluated    |

## 2. Promoted Model Test-Set Evaluation

- **Algorithm:** `HistGradientBoosting`
- **Held-out Test Accuracy:** `0.6855` (Gate: `>= 0.6`)
- **Test Log Loss:** `0.6083`
- **Test Brier Score:** `0.2084`
- **Test ROC-AUC:** `0.7504` (Gate: `>= 0.65`)
- **Model SHA-256 Checksum:** `47349f74781d5c2dcbdd2c89e20b86f98d7316cef537bfdec5b380647843663f`

## 3. Data Leakage Prevention Guarantees

- **Match-Grouped Split:** All deliveries belonging to any individual `match_id` reside strictly within a single partition (Train, Validation, or Test).
- **No Post-Match Statistics:** Features are strictly limited to state observables at prediction time (`balls_left`, `current_score`, `wickets_lost`, `target_score`, `inning`, `batting_team`, `bowling_team`).
- **Probability Calibration:** Log Loss and Brier Score serve as primary evaluation criteria rather than raw accuracy alone, ensuring faithful win probability output.
