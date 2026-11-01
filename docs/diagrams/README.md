# 🖼️ Architecture Diagram Images

The 4 high-resolution PNG architecture diagrams displayed in [`README.md`](../../README.md) are generated as code using the Python [`diagrams`](https://diagrams.mingrammer.com/) library and Graphviz (`docs/diagrams/generate_architecture_diagrams.py`). Editable Mermaid equivalents live in [`docs/architecture.md`](../architecture.md).

## Diagram Inventory

| Output PNG (`docs/images/architecture/`)                                            | Source Function                   |
| :---------------------------------------------------------------------------------- | :-------------------------------- |
| [`01_platform_overview.png`](../images/architecture/01_platform_overview.png)       | `generate_platform_overview()`    |
| [`02_live_scoring_flow.png`](../images/architecture/02_live_scoring_flow.png)       | `generate_live_scoring_flow()`    |
| [`03_ai_assistant.png`](../images/architecture/03_ai_assistant.png)                 | `generate_ai_assistant()`         |
| [`04_mlops_win_prediction.png`](../images/architecture/04_mlops_win_prediction.png) | `generate_mlops_win_prediction()` |

### Architecture Scope & Verified Facts per Diagram

- **1. [`01_platform_overview.png`](../images/architecture/01_platform_overview.png) (`generate_platform_overview()`):**
  - Depicts the 5-layer AWS + Aiven serverless topology (**`~$1/month`** combined `dev` + `prod` cloud footprint, verified by **`376` unit tests** and **`15` Playwright E2E tests**).
  - Covers Edge (Route 53, ACM, CloudFront, S3), Auth (Amplify, Cognito, IAM), and all 9 AWS Lambda microservices.
  - Includes Amazon SNS, SQS FIFO, DynamoDB, ECR (`xgboost-cpu ~309 MB`, `countNumber = 1`), S3, SES, Aiven PostgreSQL 16 (`pgvector`), CloudWatch, and AWS X-Ray.
- **2. [`02_live_scoring_flow.png`](../images/architecture/02_live_scoring_flow.png) (`generate_live_scoring_flow()`):**
  - Illustrates the dual-path real-time ball ingestion and spectator broadcast engine.
  - **Fast Path (<100ms):** `score-update` ➔ SNS (`match-events`) ➔ `broadcaster` ➔ DynamoDB connections ➔ WebSocket API Gateway.
  - **ACID Path:** `score-update` ➔ SQS FIFO (`storage-buffer.fifo`) ➔ `storage-worker` ➔ Aiven PostgreSQL, plus direct `match-api` ➔ `broadcaster` `HUB_UPDATE` sync.
- **3. [`03_ai_assistant.png`](../images/architecture/03_ai_assistant.png) (`generate_ai_assistant()`):**
  - Details the `chat-api` Lambda 3-Layer Guardrails and `CricScoreAgent` Supervisor.
  - Shows the In-Memory MCP Client-Server Hub (`MCPToolRegistry` + `InMemoryTransport`).
  - Covers the 4 Specialist Agents: Live Match DB (read-only SQL), Tournament Rulebook RAG (`pgvector`), Weather (Open-Meteo), and GitHub Issue Reporter.
- **4. [`04_mlops_win_prediction.png`](../images/architecture/04_mlops_win_prediction.png) (`generate_mlops_win_prediction()`):**
  - Traces the DVC dataset (`live_data.csv.dvc`) ➔ 8-model benchmark (`compare_models.py`) ➔ MLflow experiment tracking pipeline.
  - Shows the champion **XGBoost `v2.2.0`** quality gate ➔ S3 Model Registry + ECR (`xgboost-cpu`, `~309 MB`, `countNumber = 1`).
  - Illustrates live inference in the `ml-predict` Lambda blended with Markov Chain DP and Standard Edition DLS fallback.

---

## Regenerate All 4 Diagrams

```bash
# 1. Ensure Graphviz (`dot`) is installed
# macOS: brew install graphviz
# Ubuntu: sudo apt-get install -y graphviz

# 2. Create an isolated virtualenv and render all 4 PNGs
python3 -m venv /tmp/diagrams-venv
/tmp/diagrams-venv/bin/pip install -q diagrams
/tmp/diagrams-venv/bin/python docs/diagrams/generate_architecture_diagrams.py
```

---

## Icon Sources (`docs/diagrams/icons/`)

| Category                  | Source                                              |
| :------------------------ | :-------------------------------------------------- |
| **AWS Services**          | Bundled `diagrams.aws.*`                            |
| **Third-Party Platforms** | [Simple Icons](https://simpleicons.org/) & Favicons |
| **Generic Concepts**      | [Tabler Icons](https://tabler.io/icons) (MIT)       |

- **1. AWS Services (`diagrams.aws.*`):**
  - Route 53, ACM, CloudFront, S3, Amplify, API Gateway, Cognito, and IAM.
  - Lambda, SNS, SQS, DynamoDB, ECR, SES, CloudWatch, X-Ray, and AWS Budgets.
- **2. Third-Party Platforms (Simple Icons & Official Favicons):**
  - PostgreSQL, GitHub, GitHub Actions, and OpenAI.
  - DVC, MLflow, scikit-learn, XGBoost, and Open-Meteo.
- **3. Generic Concepts (Tabler Icons — MIT License):**
  - Users, chat interface, security guardrails, AI agent, rain/DLS weather, and database search.

> [!NOTE]
> Whenever a Lambda, API route, queue/topic, data store, MCP tool, or MLOps stage changes, update both `docs/diagrams/generate_architecture_diagrams.py` and [`docs/architecture.md`](../architecture.md), then regenerate the PNGs in the same pull request.
