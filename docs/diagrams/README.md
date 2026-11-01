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
  - Traces the request lifecycle: client static asset loading, JWT validation, REST routing, live WebSocket streaming, multi-cloud persistence, and 7-day observability.
- **2. [`02_live_scoring_flow.png`](../images/architecture/02_live_scoring_flow.png) (`generate_live_scoring_flow()`):**
  - Illustrates the dual-path real-time ball ingestion and spectator broadcast engine.
  - Explains the step-by-step numbered data flow: `1. Ball` ➔ `2. Invoke` ➔ parallel divergence into Fast Path (`3a. Publish` ➔ `4a. Trigger` ➔ `5a. Lookup` ➔ `6a. Push` ➔ `7a. Stream` to viewers in `< 1s`) and Safe Path (`3b. Enqueue` ➔ `4b. Poll` ➔ `5b. Persist` to Aiven PostgreSQL in strict FIFO order).
  - Clarifies why Fast Path (ephemeral in-memory fan-out) and Safe Path (durable ACID persistence) run concurrently rather than sequentially.
- **3. [`03_ai_assistant.png`](../images/architecture/03_ai_assistant.png) (`generate_ai_assistant()`):**
  - Details the `chat-api` Lambda 3-Layer Guardrails and `CricScoreAgent` Supervisor.
  - Shows the In-Memory MCP Client-Server Hub (`MCPToolRegistry` + `InMemoryTransport`) isolating database credentials and tokens from the LLM.
  - Traces tool execution across the 4 Specialist Agents: Match Stats (read-only SQL), Tournament Rules RAG (`pgvector`), Weather (Open-Meteo), and GitHub Issue Reporter (2-step confirmed).
- **4. [`04_mlops_win_prediction.png`](../images/architecture/04_mlops_win_prediction.png) (`generate_mlops_win_prediction()`):**
  - Traces the 4 phases from Cricsheet DVC dataset tracking (`786K+` deliveries) ➔ 8-model benchmark (`compare_models.py`) ➔ MLflow experiment tracking.
  - Shows champion **XGBoost `v2.2.0`** promotion through CI quality gates (`Acc >= 60%`, `AUC >= 65%`) to Amazon S3 (`models/v2.2.0/`) and Amazon ECR (`xgboost-cpu ~309 MB`, `countNumber = 1`).
  - Illustrates real-time hybrid inference in `ml-predict` combining XGBoost + Markov Chain DP + DLS Par curves with cold-start `/tmp` caching and SHA-256 verification.

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
