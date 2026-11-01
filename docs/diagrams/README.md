# 🖼️ Architecture Diagram Images

The 4 high-resolution PNG architecture diagrams displayed in [`README.md`](../../README.md) are generated as code using the Python [`diagrams`](https://diagrams.mingrammer.com/) library and Graphviz (`docs/diagrams/generate_architecture_diagrams.py`). Editable Mermaid equivalents live in [`docs/architecture.md`](../architecture.md).

## Diagram Inventory

| Output PNG (`docs/images/architecture/`)                                            | Source Function                   | Architecture Scope & Key Facts                                                                                                                                                                                                                       |
| :---------------------------------------------------------------------------------- | :-------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`01_platform_overview.png`](../images/architecture/01_platform_overview.png)       | `generate_platform_overview()`    | • 5-layer AWS + Aiven topology (`~$1/month` combined `dev` + `prod`)<br/>• Edge (Route 53, ACM, CloudFront, S3), Auth (Amplify, Cognito, IAM), and 9 Lambdas<br/>• SNS, SQS FIFO, DynamoDB, ECR (`xgboost-cpu ~309 MB`), S3, SES, PostgreSQL, X-Ray  |
| [`02_live_scoring_flow.png`](../images/architecture/02_live_scoring_flow.png)       | `generate_live_scoring_flow()`    | • Dual-path real-time scoring engine<br/>• Fast-path: SNS ➔ `broadcaster` ➔ DynamoDB ➔ WebSocket API Gateway<br/>• ACID path: SQS FIFO ➔ `storage-worker` ➔ PostgreSQL + direct `match-api` ➔ `broadcaster` `HUB_UPDATE` sync                        |
| [`03_ai_assistant.png`](../images/architecture/03_ai_assistant.png)                 | `generate_ai_assistant()`         | • `chat-api` Lambda 3-Layer Guardrails & `CricScoreAgent` Supervisor<br/>• In-Memory MCP Client-Server Hub (`MCPToolRegistry`)<br/>• 4 Specialist Agents: Live Match DB, Rulebook RAG, Weather (Open-Meteo), and GitHub Issue Reporter               |
| [`04_mlops_win_prediction.png`](../images/architecture/04_mlops_win_prediction.png) | `generate_mlops_win_prediction()` | • DVC dataset (`live_data.csv.dvc`) ➔ 8-model benchmark (`compare_models.py`) ➔ MLflow tracking<br/>• XGBoost `v2.2.0` quality gate ➔ S3 Model Registry + ECR (`xgboost-cpu`, `~309 MB`, `countNumber = 1`)<br/>• `ml-predict` Lambda + DLS fallback |

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

| Category                  | Source                                              | Icons Used                                                                                                                                 |
| :------------------------ | :-------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| **AWS Services**          | Bundled `diagrams.aws.*`                            | • Route 53, ACM, CloudFront, S3, Amplify, API Gateway, Cognito, IAM<br/>• Lambda, SNS, SQS, DynamoDB, ECR, SES, CloudWatch, X-Ray, Budgets |
| **Third-Party Platforms** | [Simple Icons](https://simpleicons.org/) & Favicons | • PostgreSQL, GitHub, GitHub Actions, OpenAI<br/>• DVC, MLflow, scikit-learn, XGBoost, Open-Meteo                                          |
| **Generic Concepts**      | [Tabler Icons](https://tabler.io/icons) (MIT)       | • Users, chat, guardrails, AI agent<br/>• Rain/DLS, database search                                                                        |

> [!NOTE]
> Whenever a Lambda, API route, queue/topic, data store, MCP tool, or MLOps stage changes, update both `docs/diagrams/generate_architecture_diagrams.py` and [`docs/architecture.md`](../architecture.md), then regenerate the PNGs in the same pull request.
