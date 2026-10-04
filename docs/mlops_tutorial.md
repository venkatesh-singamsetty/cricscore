# 🤖 Zero-Cost Serverless MLOps Tutorial

This guide walks through the end-to-end Machine Learning Operations (MLOps) pipeline integrated into the CricScore project. The goal of this pipeline is to predict the outcome of a T20 match based on historical data.

Most importantly, this pipeline is designed to be **100% free** and highly scalable. It avoids expensive GPU instances, heavy ML platforms (like SageMaker), or large inference servers by leveraging GitHub Actions for training and AWS Lambda for inference.

---

## 🏗️ 1. Architecture Overview

The MLOps pipeline consists of four main stages:

1. **Data Ingestion & Preprocessing**: Automatically downloads raw ball-by-ball JSON data from [Cricsheet](https://cricsheet.org/) and compiles it into a structured tabular format (`matches.csv`).
2. **Model Training & Evaluation**: Trains a lightweight Scikit-Learn `LogisticRegression` model. The training script strictly enforces chronological data splitting to prevent **data leakage** (future events predicting past outcomes).
3. **Continuous Integration (CI) Gate**: A GitHub Actions workflow that automatically runs the pipeline on any changes. It enforces a strict accuracy gate (e.g., >60%) before allowing the model artifact to be committed or deployed.
4. **Serverless Inference**: The model is bundled directly into an AWS Lambda function deployment package, exposing a `POST /match/predict` endpoint via API Gateway with sub-100ms latency.

---

## 📊 2. The Data Pipeline (`data_pipeline.py`)

**Location**: `apps/ml-engine/data_pipeline.py`

Cricsheet provides highly detailed JSON files for every match. The data pipeline's job is to parse thousands of these files and extract high-level features.

**Key Steps:**

1. **Download**: Fetches `t20s_json.zip` directly from Cricsheet.
2. **Parsing**: Iterates through each JSON file to extract pre-match variables:
   - `team1`, `team2`
   - `venue`
   - `toss_winner`, `toss_decision`
3. **Label Extraction**: Determines the match winner.
4. **Export**: Saves a clean, flattened `matches.csv` into a `.gitignore`'d directory (`apps/ml-engine/data/`) to prevent bloating the Git repository.

---

## 🧠 3. Model Training (`train.py`)

**Location**: `apps/ml-engine/train.py`

Because AWS Lambda has a strict 250MB uncompressed limit for deployment packages, we cannot use heavy libraries like XGBoost alongside Pandas and Scikit-Learn. We opted for `LogisticRegression` to keep the deployment footprint small (~50MB).

**Key ML Concepts Applied:**

- **Time-Series Validation**: Matches are sorted by date. The oldest 80% are used for training, and the newest 20% are used for testing. This mimics real-world conditions where the model must predict future matches.
- **Categorical Encoding**: `OneHotEncoder` is used within a `ColumnTransformer` to handle string-based features like Team Names and Venues.
- **Pipeline Abstraction**: The preprocessing steps and the estimator are bundled into a single Scikit-Learn `Pipeline` object. This ensures that the exact same transformations applied during training are automatically applied during live inference.
- **Artifact Generation**: The pipeline outputs two files:
  - `win_predictor_model.joblib`: The serialized model weights (only ~1MB).
  - `metadata.json`: Contains model version, accuracy metrics, and timestamp.

---

## 🚦 4. Automated CI/CD Gate (`mlops-pipeline.yml`)

**Location**: `.github/workflows/mlops-pipeline.yml`

ML models degrade over time (Data Drift). To keep the model fresh, we need a way to safely retrain it.

This GitHub Action triggers whenever changes are made in `apps/ml-engine/`.

1. It installs dependencies (`scikit-learn`, `pandas`).
2. Runs the data pipeline.
3. Runs the training script.
4. **The Gate**: The training script exits with an error code (e.g., `sys.exit(1)`) if the model accuracy falls below 60%. If the accuracy is satisfactory, the GitHub Action proceeds.
5. The resulting lightweight `.joblib` model artifact can then be securely included in the Lambda deployment package.

---

## ☁️ 5. Serverless Inference (`predict.py`)

**Location**: `apps/ml-engine/predict.py` & `infra/terraform/lambda.tf`

Instead of deploying a container that runs 24/7, the model is served using AWS Lambda.

**How it works:**

1. **Bundling**: The `win_predictor_model.joblib` and `metadata.json` files are placed alongside the `predict.py` handler.
2. **Cold Start Optimization**: The model is loaded into memory _outside_ the Lambda handler function. This means the model is only loaded from disk once per container initialization, making subsequent requests extremely fast (often <50ms).
3. **Execution**: The handler accepts a JSON payload (teams, venue, toss info), creates a Pandas DataFrame, runs `model.predict_proba()`, and returns the win probability for both teams.

---

## 🖥️ 6. Frontend Integration

**Location**: `apps/frontend/src/components/AiMatchPrediction.tsx`

The React frontend seamlessly integrates with the Lambda endpoint. Inside the Live Scoreboard view, an `AiMatchPrediction` component issues a `POST` request to the API Gateway.

The UI visualizes the probabilities using a dynamic progress bar, providing fans and scorers with real-time AI insights while the match progresses.

---

## 🔮 Future Enhancements

As this is an experimental pipeline, there are several ways to scale it up:

- **In-Match Live Predictions**: Currently, the model only uses pre-match features. A more advanced model could take the current score (`runs/wickets/overs`) and adjust the probability live.
- **Player-Level Data**: Aggregating individual player statistics (strike rate, bowling economy) to determine team strength rather than relying solely on historical team-vs-team outcomes.
- **Containerized Lambdas**: Migrating the Lambda deployment to an AWS ECR Docker Container (up to 10GB limit) to allow the use of more complex architectures like XGBoost or LightGBM.
