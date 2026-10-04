# 🤖 Zero-Cost Serverless MLOps Tutorial

This guide walks through the end-to-end Machine Learning Operations (MLOps) pipeline integrated into the CricScore project. The goal of this pipeline is to predict the outcome of a T20 match based on historical data.

Most importantly, this pipeline is designed to be **100% free** and highly scalable. It avoids expensive GPU instances, heavy ML platforms (like SageMaker), or large inference servers by leveraging GitHub Actions for training and AWS Lambda for inference.

---

## 🏗️ 1. Architecture Overview

```mermaid
graph TD
    %% Define Data Flow
    subgraph Data Source
        Cricsheet[Cricsheet JSON Archives]
        DB[(CricScore PostgreSQL)]
    end

    %% Define Training Pipeline (GitHub Actions)
    subgraph GitHub Actions [Automated CI/CD Pipeline]
        DP[data_pipeline.py]
        LT[live_train.py]
        TEST[PyTest Validation]
        GATE{Accuracy > 60%?}
    end

    %% Define Deployment
    subgraph AWS Deployment [Serverless AWS]
        ECR[Amazon ECR Container Registry]
        LAMBDA[AWS Lambda Inference API]
        APIGW[Amazon API Gateway]
    end

    %% Frontend App
    subgraph Client
        UI[React Frontend: LiveScoreboard]
    end

    %% Connections
    Cricsheet -- Download & Parse --> DP
    DB -- Future Enhancement --> DP
    DP -- "live_data.csv" --> LT
    LT -- "live_win_predictor_model.joblib" --> TEST
    TEST -- Pass --> GATE
    GATE -- "Yes (Deploy)" --> ECR
    GATE -- "No (Fail Build)" --> STOP((Stop))

    ECR -- "10GB Docker Image" --> LAMBDA
    LAMBDA -- "POST /match/predict" --> APIGW
    UI -- "Every ball bowled" --> APIGW
    APIGW -- "Win Probability %" --> UI
```

The MLOps pipeline consists of four main stages:

1. **Data Ingestion & Preprocessing**: Automatically downloads raw ball-by-ball JSON data from [Cricsheet](https://cricsheet.org/) and compiles it into a structured tabular format (`live_data.csv`).
2. **Model Training & Evaluation**: Trains a lightweight Scikit-Learn `LogisticRegression` model. The training script strictly enforces chronological data splitting to prevent **data leakage** (future events predicting past outcomes).
3. **Continuous Integration (CI) Gate**: A GitHub Actions workflow that automatically runs the pipeline on a monthly cron schedule or manual trigger. It runs a `pytest` suite and enforces a strict accuracy gate (e.g., >60%) before deploying the model.
4. **Serverless Inference**: The model is bundled into an AWS ECR Docker Container, exposing a `POST /match/predict` endpoint via API Gateway with sub-100ms latency.

---

## 📊 2. The Data Pipeline (`live_data.csv`)

**Location**: `apps/ml-engine/data/live_data.csv` (Ignored by Git)

The data pipeline extracts ball-by-ball match situations instead of just pre-match summaries.

**Key Features Extracted:**

- `current_score`: Total runs scored so far.
- `wickets_lost`: Number of wickets fallen.
- `balls_left`: Remaining balls in the innings.
- `target_score`: The target score to win (if in the 2nd innings, otherwise -1).
- `winner`: The team that ultimately won the match.

The script compiles a highly structured `live_data.csv` into a `.gitignore`'d directory (`apps/ml-engine/data/`) to prevent bloating the Git repository.

---

## 🧠 3. Model Training (`live_train.py`)

**Location**: `apps/ml-engine/live_train.py`

We use a robust `LogisticRegression` model trained on in-match dynamic variables.

**Key ML Concepts Applied:**

- **Dynamic State Evaluation**: The model assesses win probability based on the _current match situation_ rather than static pre-match attributes.
- **Categorical Encoding**: Handles string-based features (Team Names).
- **Artifact Generation**: The pipeline outputs two files:
  - `live_win_predictor_model.joblib`: The serialized model weights.
  - `live_metadata.json`: Contains model version, accuracy metrics, and timestamp.

---

## 🚦 4. Automated CI/CD Gate (`mlops-pipeline.yml`)

**Location**: `.github/workflows/mlops-pipeline.yml`

ML models degrade over time (Data Drift). To keep the model fresh, we need a way to safely retrain it.

This GitHub Action triggers whenever changes are made in `apps/ml-engine/`.

1. It installs dependencies (`scikit-learn`, `pandas`).
2. Runs the data pipeline.
3. Runs the training script.
4. **The Gate**: The training script exits with an error code if the model accuracy falls below acceptable thresholds.
5. The resulting lightweight `.joblib` model artifact is then bundled for deployment.

---

## ☁️ 5. Serverless Docker Inference (`predict.py`)

**Location**: `apps/ml-engine/predict.py` & `apps/ml-engine/Dockerfile`

Instead of deploying a traditional zipped Lambda package, the live model is containerized using Docker and hosted on **AWS ECR (Elastic Container Registry)**.

**Serverless Container Execution (Firecracker MicroVM):**
A common misconception is that a Docker image in ECR requires a running server (like ECS or Fargate) to serve requests. However, AWS Lambda natively supports Docker Images under the hood using **Firecracker MicroVMs**.

- The image sits idle in ECR costing nothing.
- When an API Gateway request arrives, Lambda provisions a MicroVM, spins up the container in milliseconds, and executes `predict.py`.
- Once the response is sent, the container is frozen. If no new requests arrive, it is automatically destroyed. You get the heavy dependency support of Docker with the zero-idle-cost benefits of Serverless!

**How it works:**

1. **Containerization**: A `Dockerfile` bundles the `live_win_predictor_model.joblib`, `predict.py`, and dependencies into an AWS Lambda Python base image.
2. **ECR Storage**: The image is pushed to a Private ECR Repository. Private ECR provides **500MB per month of free storage** under the AWS Free Tier. We overwrite the `latest` tag continuously to ensure we stay well under this 500MB free limit (even though Lambda container images can theoretically support up to 10GB sizes).
3. **Execution**: The handler accepts a JSON payload of the live match state, executes `model.predict_proba()`, and returns live ball-by-ball win probabilities.

---

## 🖥️ 6. Frontend Integration

**Location**: `apps/frontend/src/components/AiMatchPrediction.tsx`

The React frontend seamlessly integrates with the Lambda endpoint. Inside the Live Scoreboard view, an `AiMatchPrediction` component issues a `POST` request to the API Gateway after every single ball.

The UI visualizes the probabilities using a compact progress bar nestled right inside the scoreboard header, providing fans and scorers with real-time AI insights.

---

## 🛑 7. Lessons Learned & Troubleshooting

During the development of this MLOps pipeline, we faced and resolved several critical infrastructure issues:

- **AWS Lambda Zip Size Limits**: Initially, we deployed the model via standard `.zip` files. However, the combined size of `pandas`, `scikit-learn`, and the `.joblib` model exceeded Lambda's strict 250MB unzipped limit. **Fix**: We migrated the architecture to AWS ECR Docker Container Images, which increased the limit to 10GB.
- **Lambda Memory Thrashing (Timeouts)**: The initial Lambda memory size was set to `128MB`. Loading the ML libraries and model weights caused intense CPU thrashing and disk swapping, leading to function timeouts (>10s). **Fix**: We increased the Lambda memory allocation to `1024MB`, which proportionately scaled up the underlying vCPU power and reduced inference time to sub-100ms.
- **Public vs. Private ECR Free Tier Cost Traps**: We considered using Amazon Public ECR to make the image accessible, but discovered Public ECR only offers a 50GB free tier that _expires_ or costs money for high bandwidth, while **Private ECR offers a perpetual 500MB/month free tier**. **Fix**: We stayed with Private ECR and enforced a strategy of continuously overwriting the `latest` image tag during CI/CD to prevent older versions from bloating our 500MB storage limit over time.

---

## 🔮 Future Enhancements

As this is an experimental pipeline, there are several ways to scale it up:

- **Player-Level Data**: Aggregating individual player statistics (strike rate, bowling economy) to determine team strength dynamically based on who is currently at the crease.
- **Deep Learning**: Now that we use ECR Containers, we have the space to include heavier frameworks like PyTorch or TensorFlow if the model complexity increases.
