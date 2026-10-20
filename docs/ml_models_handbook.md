# CricScore Machine Learning Models Revision Handbook

This handbook provides an engineering and theoretical reference for the **14 fundamental machine learning algorithms** across **Regression**, **Classification**, and **Clustering**, grounded in real-world application to the CricScore Cricket Analytics Platform.

---

## 📑 Table of Contents

1. [Architectural Overview & Problem Formulations](#architectural-overview)
2. [🎯 Classification Models (Win Probability Prediction)](#classification-models)
   - [1. Logistic Regression](#1-logistic-regression)
   - [2. K-Nearest Neighbors (KNN)](#2-k-nearest-neighbors-knn)
   - [3. Support Vector Machine (SVM)](#3-support-vector-machine-svm)
   - [4. Naive Bayes (Gaussian)](#4-naive-bayes-gaussian)
   - [5. Decision Tree](#5-decision-tree)
   - [6. Random Forest (Ensemble Bagging)](#6-random-forest-ensemble-bagging)
   - [7. XGBoost (Extreme Gradient Boosting)](#7-xgboost-extreme-gradient-boosting)
3. [📈 Regression Models (1st-Innings Projected Score)](#regression-models)
   - [8. Simple Linear Regression (SLR)](#8-simple-linear-regression-slr)
   - [9. Polynomial Regression](#9-polynomial-regression)
   - [10. Support Vector Regression (SVR)](#10-support-vector-regression-svr)
   - [11. Lasso Regression (L1 Regularization)](#11-lasso-regression-l1-regularization)
   - [12. Ridge Regression (L2 Regularization)](#12-ridge-regression-l2-regularization)
4. [🎡 Clustering Models (Pitch & Match Condition Profiling)](#clustering-models)
   - [13. K-Means Clustering](#13-k-means-clustering)
   - [14. Hierarchical (Agglomerative) Clustering](#14-hierarchical-agglomerative-clustering)
5. [📊 Empirical CricScore Benchmark Summary](#empirical-benchmark-summary)
6. [💡 System Design & Interview Trap Cheat Sheet](#system-design--interview-cheat-sheet)

---

## <a name="architectural-overview"></a>1. Architectural Overview & Problem Formulations

In CricScore, machine learning is applied to three distinct sports analytics paradigms:

| Paradigm           | Target Task                                     | Target Variable ($y$)                     | Feature Vector ($X$)                                                              | Primary Metric             |
| ------------------ | ----------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- | -------------------------- |
| **Classification** | Live Ball-by-Ball Match Win Probability         | Binary Winner $\in \{0, 1\}$              | Batting team, bowling team, balls left, current score, wickets lost, target score | **Log Loss & Brier Score** |
| **Regression**     | 1st-Innings Projected Final Score               | Continuous Final Runs $\in \mathbb{R}^+$  | Current score, balls bowled, balls left, wickets lost, current run rate           | **RMSE & MAE**             |
| **Clustering**     | Pitch Condition / Scoring Environment Profiling | Unsupervised Clusters $k \in \{1, 2, 3\}$ | Final match score, average runs per over (RPO), total innings wickets             | **Silhouette Score**       |

---

## <a name="classification-models"></a>2. 🎯 Classification Models (Win Probability Prediction)

### 1. Logistic Regression

- **Mathematical Formulation**:
  $$P(y=1|X) = \sigma(w^T X + b) = \frac{1}{1 + e^{-(w^T X + b)}}$$
  Loss function: Binary Cross-Entropy / Log Loss:
  $$J(w) = -\frac{1}{N} \sum_{i=1}^N \left[ y_i \log(\hat{y}_i) + (1 - y_i) \log(1 - \hat{y}_i) \right]$$
- **Cricket Context**: Used as the foundational baseline model. It models the odds ratio of victory as a monotonic linear combination of balls and runs.
- **Empirical Results (CricScore Dataset)**:
  - Val LogLoss: `0.8069` | Val ROC-AUC: `0.7550` | Val Accuracy: `65.59%` | Size: `8 KB` | Latency: `1.23 ms`.
- **Pros & Cons**:
  - _Pros_: Extremely fast, zero risk of overfitting on small feature spaces, weights $w_i$ give direct log-odds interpretability.
  - _Cons_: Cannot capture non-linear cricket phase dynamics (e.g., losing 3 wickets in the Powerplay vs. losing 3 wickets in the death overs has an asymmetric effect on win probability).

---

### 2. K-Nearest Neighbors (KNN)

- **Mathematical Formulation**:
  Given query instance $x_q$, find $k$ nearest neighbors $\mathcal{N}_k(x_q)$ under distance metric $d(x, z) = \sqrt{\sum (x_j - z_j)^2}$:
  $$\hat{P}(y=1|x_q) = \frac{1}{k} \sum_{i \in \mathcal{N}_k(x_q)} \mathbb{I}(y_i = 1)$$
- **Cricket Context**: Predicts outcome based on the historical matches that had the most similar scoreboard state ($R$ runs, $W$ wickets, $B$ balls remaining).
- **Empirical Results (CricScore Dataset)**:
  - Val LogLoss: `8.7168` | Val ROC-AUC: `0.7185` | Val Accuracy: `69.65%` | Latency: **`66.15 ms`** ⚠️.
- **Pros & Cons**:
  - _Pros_: Non-parametric, makes zero assumptions about underlying probability distributions.
  - _Cons_: **Catastrophic for Serverless Production**: $O(N \cdot D)$ inference complexity requires storing all 84,000+ training points in memory and evaluating pairwise distances for every live ball. High log loss due to uncalibrated step-function probability outputs.

---

### 3. Support Vector Machine (SVM)

- **Mathematical Formulation**:
  Finds maximum-margin separating hyperplane $w^T x + b = 0$ solving:
  $$\min_{w, b, \xi} \frac{1}{2} \|w\|^2 + C \sum_{i=1}^N \xi_i \quad \text{s.t. } y_i(w^T x_i + b) \ge 1 - \xi_i, \quad \xi_i \ge 0$$
  Calibrated for probabilities via Platt Scaling: $\hat{P}(y=1|x) = \frac{1}{1 + \exp(A \cdot f(x) + B)}$.
- **Cricket Context**: Optimizes boundary separation between winning and losing match trajectories in normalized feature space.
- **Empirical Results (CricScore Dataset)**:
  - Val LogLoss: `0.6526` | Val ROC-AUC: `0.7704` | Val Accuracy: `67.55%` | Size: `9 KB` | Latency: `1.35 ms`.
- **Pros & Cons**:
  - _Pros_: Effective in high-dimensional feature representations, robust to outliers outside the margin support vectors.
  - _Cons_: Standard kernel SVM ($O(N^3)$ training) does not scale to 100k+ ball rows; requires linear SGD approximation with Platt scaling for real-time inference.

---

### 4. Naive Bayes (Gaussian)

- **Mathematical Formulation**:
  Applies Bayes' Theorem assuming conditional independence between features given class $y$:
  $$P(y=c | X) \propto P(y=c) \prod_{j=1}^D \mathcal{N}(x_j; \mu_{cj}, \sigma_{cj}^2)$$
- **Cricket Context**: Computes likelihood of current ball state based on historical independent distributions of runs, balls, and wickets.
- **Empirical Results (CricScore Dataset)**:
  - Val LogLoss: **`9.5548`** ❌ | Val ROC-AUC: `0.6487` | Val Accuracy: `64.36%` | Size: `13 KB`.
- **Pros & Cons**:
  - _Pros_: Sub-second training (`0.15s`), requires minimal data.
  - _Cons_: **Violates Core Cricket Assumptions**: Features (`balls_left`, `current_score`, `wickets_lost`, `target_score`) are intrinsically correlated. The independence assumption causes severe overconfidence ($0.0001$ or $0.9999$ probabilities), resulting in disastrous log loss.

---

### 5. Decision Tree

- **Mathematical Formulation**:
  Recursively partitions feature space using Gini Impurity or Cross-Entropy:
  $$\text{Gini}(S) = 1 - \sum_{k=1}^K p_k^2, \quad \Delta \text{Gini} = \text{Gini}(S) - \frac{|S_L|}{|S|}\text{Gini}(S_L) - \frac{|S_R|}{|S|}\text{Gini}(S_R)$$
- **Cricket Context**: Generates human-interpretable cricket rule thresholds (e.g., `IF balls_left <= 18 AND required_run_rate > 12.5 AND wickets_lost >= 6 THEN win_prob = 0.08`).
- **Empirical Results (CricScore Dataset)**:
  - Val LogLoss: `0.8488` | Val ROC-AUC: `0.7558` | Val Accuracy: `69.98%` | Size: `15 KB` | Latency: `1.16 ms`.
- **Pros & Cons**:
  - _Pros_: Highly interpretable, mirrors cricket coaching decision heuristics.
  - _Cons_: High variance, prone to overfitting, discrete step-function probability estimates cause poor calibration.

---

### 6. Random Forest (Ensemble Bagging)

- **Mathematical Formulation**:
  Averages $B$ de-correlated bootstrap trees grown with random feature subspace sampling ($m = \sqrt{D}$):
  $$\hat{P}(y=1|x) = \frac{1}{B} \sum_{b=1}^B T_b(x)$$
- **Cricket Context**: Mitigates single-tree variance by averaging over multiple match scenarios and feature combinations.
- **Empirical Results (CricScore Dataset)**:
  - Val LogLoss: `0.6136` | Val ROC-AUC: `0.7561` | Val Accuracy: `68.19%` | Size: `702 KB` | Latency: `16.08 ms`.
- **Pros & Cons**:
  - _Pros_: Robust to noisy data, handles non-linear interactions automatically.
  - _Cons_: 50+ trees require traversing multiple memory pointers per ball, resulting in higher latency (`16 ms`) than gradient boosted trees.

---

### 7. XGBoost (Extreme Gradient Boosting) 🏆

- **Mathematical Formulation**:
  Sequential additive tree ensemble optimizing 2nd-order Taylor expansion of objective with shrinkage and regularization:
  $$\mathcal{L}^{(t)} \approx \sum_{i=1}^N \left[ g_i f_t(x_i) + \frac{1}{2} h_i f_t^2(x_i) \right] + \gamma T + \frac{1}{2} \lambda \sum_{j=1}^T w_j^2$$
  where $g_i = \partial_{\hat{y}^{(t-1)}} \ell(y_i, \hat{y}^{(t-1)})$ and $h_i = \partial_{\hat{y}^{(t-1)}}^2 \ell(y_i, \hat{y}^{(t-1)})$.
- **Cricket Context**: Learns complex phase shifts, momentum swings, and target pressure through weighted gradient residuals.
- **Empirical Results (CricScore Dataset)**:
  - **Val LogLoss**: **`0.5786`** (Lowest) 🏆
  - **Val ROC-AUC**: **`0.7723`** (Highest) 🏆
  - **Val Brier Score**: **`0.1992`** (Best Calibration) 🏆
  - **Test Accuracy**: **`69.01%`** 🏆
  - **Train Time**: **`0.69s`** | **Model Size**: **`73 KB`** | **Latency**: **`1.65 ms`** ⚡.
- **Pros & Cons**:
  - _Pros_: Best calibration, lowest log loss, ultra-compact memory footprint, sub-millisecond compiled C++ tree traversal.
  - _Cons_: Requires careful learning rate ($\eta$) and depth regularization to prevent over-indexing on rare collapse matches.

---

## <a name="regression-models"></a>3. 📈 Regression Models (1st-Innings Projected Score)

### 8. Simple Linear Regression (SLR)

- **Formulation**: $\hat{y} = w_1 x + b$ (Ordinary Least Squares: $\min \|y - Xw\|^2_2$).
- **Cricket Context**: Direct run rate projection: $\text{Final Score} = \text{Current Score} + (\text{RPO} \times \text{Overs Left})$.
- **Benchmark**: RMSE: `25.10 runs` | MAE: `18.24 runs` | $R^2$: `0.6186` | Train: `0.008s`.

### 9. Polynomial Regression (Degree 2)

- **Formulation**: $\hat{y} = w_0 + w_1 x + w_2 x^2 + \dots + w_d x^d$.
- **Cricket Context**: Models non-linear death overs acceleration (scoring accelerates quadratically in the final 5 overs as wickets in hand are preserved).
- **Benchmark**: **RMSE: `24.45 runs`** 🏆 | **MAE: `17.50 runs`** 🏆 | **$R^2$: `0.6380`** 🏆 | Train: `0.046s`.

### 10. Support Vector Regression (SVR)

- **Formulation**: $\min \frac{1}{2}\|w\|^2 + C \sum (\xi_i + \xi_i^*)$ subject to $|y_i - (w^T x_i + b)| \le \epsilon$.
- **Cricket Context**: Disregards errors within an $\epsilon$-tube of runs (e.g., $\pm 5$ runs normal variance), focusing only on anomalous outlier overs.
- **Benchmark**: RMSE: `25.31 runs` | MAE: `18.11 runs` | $R^2$: `0.6120` | Train: `0.026s`.

### 11. Lasso Regression (L1 Regularization)

- **Formulation**: $\min \|y - Xw\|^2_2 + \lambda \|w\|_1$.
- **Cricket Context**: Automatic feature selection that forces redundant collinear features (e.g., `overs_bowled` vs `balls_left`) to exact zero weights.
- **Benchmark**: RMSE: `25.29 runs` | MAE: `18.38 runs` | $R^2$: `0.6128` | Train: `0.013s`.

### 12. Ridge Regression (L2 Regularization)

- **Formulation**: $\min \|y - Xw\|^2_2 + \lambda \|w\|^2_2$.
- **Cricket Context**: Shrinks weights smoothly to prevent runaway coefficients caused by strong collinearity between `current_score` and `balls_bowled`.
- **Benchmark**: RMSE: `25.10 runs` | MAE: `18.24 runs` | $R^2$: `0.6186` | Train: `0.006s`.

---

## <a name="clustering-models"></a>4. 🎡 Clustering Models (Pitch & Match Condition Profiling)

### 13. K-Means Clustering

- **Formulation**: Partitions $N$ matches into $k$ Voronoi cells minimizing within-cluster sum of squares (WCSS / Inertia):
  $$\arg\min_S \sum_{i=1}^k \sum_{x \in S_i} \|x - \mu_i\|^2$$
- **Cricket Context**: Discovers 3 distinct T20 match archetypes from 3,310 innings:
  1. **Batting Paradise** ($\sim 201$ runs, $10.1$ RPO, $4.7$ wickets).
  2. **Bowling Minefield** ($\sim 106$ runs, $5.5$ RPO, $9.0$ wickets).
  3. **Balanced Competitive Pitch** ($\sim 155$ runs, $7.8$ RPO, $7.0$ wickets).
- **Benchmark**: **Silhouette Score: `0.3662`** 🏆 | Execution Time: `0.31s`.

### 14. Hierarchical (Agglomerative) Clustering

- **Formulation**: Bottom-up agglomeration merging clusters that minimize Ward's minimum variance criterion:
  $$\Delta \text{ESS} = \frac{n_A n_B}{n_A + n_B} \|\mu_A - \mu_B\|^2$$
- **Cricket Context**: Constructs dendrogram of tournament pitch behaviors over time.
- **Benchmark**: Silhouette Score: `0.3141` | Execution Time: `0.50s`.

---

## <a name="empirical-benchmark-summary"></a>5. 📊 Empirical CricScore Benchmark Summary

```
=========================================================================================================
Model                  | Family         | Val LogLoss | Val ROC-AUC | Val Brier  | Latency  | Status
=========================================================================================================
LogisticRegression     | Classification |      0.8069 |      0.7550 |     0.2379 |   1.23ms | Baseline
GaussianNB             | Classification |      9.5548 |      0.6487 |     0.3515 |   1.31ms | Rejected
KNN (k=7)              | Classification |      8.7168 |      0.7185 |     0.2784 |  66.15ms | Rejected
DecisionTree           | Classification |      0.8488 |      0.7558 |     0.2014 |   1.16ms | Evaluated
LinearSVM (SGD)        | Classification |      0.6526 |      0.7704 |     0.2148 |   1.35ms | Evaluated
RandomForest           | Classification |      0.6136 |      0.7561 |     0.2119 |  16.08ms | Evaluated
ExtraTrees             | Classification |      0.6532 |      0.7118 |     0.2302 |  15.86ms | Evaluated
HistGradientBoosting   | Classification |      0.5998 |      0.7642 |     0.2063 |   4.05ms | Former Champ
XGBoost (XGBClassifier)| Classification |      0.5786 |      0.7723 |     0.1992 |   1.65ms | 🏆 Champion
---------------------------------------------------------------------------------------------------------
Polynomial Reg (d=2)   | Regression     | RMSE: 24.45 | MAE: 17.50  | R²: 0.6380 |   0.046s | Best Regressor
K-Means (k=3)          | Clustering     | Silhouette: 0.3662        | Inertia: WCSS | 0.315s | Best Clustering
=========================================================================================================
```

---

## <a name="system-design--interview-cheat-sheet"></a>6. 💡 System Design & Interview Trap Cheat Sheet

### Common Technical Interview Questions

1. **Why is Accuracy a misleading metric for cricket win probability?**
   - _Answer_: Cricket scoring requires _well-calibrated probabilities_, not binary class thresholding at 0.5. A team needing 2 runs from 30 balls should have a 99% win probability, not 51%. **Log Loss** and **Brier Score** penalize poorly calibrated overconfidence exponentially, making them the proper loss metrics for betting and live broadcasting.

2. **Why does Naive Bayes fail so dramatically on cricket data?**
   - _Answer_: Naive Bayes assumes $P(X_1, X_2 | Y) = P(X_1 | Y)P(X_2 | Y)$. In cricket, $X_1 = \text{balls\_left}$ and $X_2 = \text{current\_score}$ are inextricably coupled. When one feature reaches an extreme, the multiplied probabilities degenerate to 0 or 1, triggering extreme logarithmic loss penalties ($-\log(10^{-6}) \to \infty$).

3. **Why is KNN inappropriate for real-time AWS Lambda inference?**
   - _Answer_: KNN is a "lazy learner" with $O(N \cdot D)$ inference cost. With 84,000 training points and 7 features, calculating Euclidean distance on every ball takes 66ms on Lambda, increasing execution cost and memory pressure. XGBoost, by contrast, evaluates static pre-compiled decision trees in 1.6ms.

4. **Lasso (L1) vs. Ridge (L2) for cricket run rate modeling:**
   - _Answer_: If features have severe multicollinearity (e.g., `balls_bowled` and `balls_left = 120 - balls_bowled`), Ridge ($L_2$) shrinks both coefficients proportionally, retaining all features with smaller variance. Lasso ($L_1$) selects one feature arbitrarily and zeroes out the other, acting as a sparse feature selector.

5. **How does XGBoost prevent overfitting in cricket models?**
   - _Answer_: XGBoost includes explicit regularization terms in its objective: $\gamma T$ (penalizing tree leaf count $T$) and $\frac{1}{2}\lambda \sum w_j^2$ ($L_2$ regularization on leaf weights $w_j$), along with column subsampling (`colsample_bytree`) and learning rate shrinkage ($\eta = 0.1$).
