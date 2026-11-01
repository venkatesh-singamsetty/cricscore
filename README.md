# 🏏 CricScore: Real-Time Cricket Match Engine

[![CI/CD Pipeline](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml/badge.svg)](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml)
[![Production Release](https://img.shields.io/github/v/release/venkatesh-singamsetty/cricscore?label=production&color=success)](https://github.com/venkatesh-singamsetty/cricscore/releases)
[![Automated Tests](https://img.shields.io/badge/Tests-376%20Passing-brightgreen?logo=vitest)](./docs/testing.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Python ML](https://img.shields.io/badge/Python-ML_Engine-blue?logo=python)](https://www.python.org/)
[![Terraform](https://img.shields.io/badge/Terraform-Managed-purple?logo=terraform)](https://www.terraform.io/)
[![AWS Cloud Cost](https://img.shields.io/badge/AWS%20Cost-~%241%2Fmo-blue?logo=amazon-aws)](./docs/cost_management.md)
[![License: MIT](https://img.shields.io/badge/License:MIT-yellow.svg)](https://opensource.org/licenses/MIT)

🚀 **Production Environment:** **https://cricscore.venkateshsingamsetty.com** · 🧪 **Development Environment:** **https://cricscoredev.venkateshsingamsetty.com**

👉 **Quick Links:** **[Full Deployment Guide](./docs/deployment.md)** · ⚡ **[Developer Cheatsheet](./CHEATSHEET.md)** · 🛠️ **[Contributing & PR Guide](./CONTRIBUTING.md)** · 🏆 **[Engineering Milestones & Key PRs](./docs/engineering_milestones.md)**

---

## 🎯 Project Overview

CricScore is a cloud-native, real-time cricket scoring and match analytics platform built with **AWS Serverless**, **Aiven PostgreSQL 16 (`pgvector`)**, **Agentic AI (MCP + RAG)**, and **Serverless MLOps (XGBoost + Markov DP + DLS)**. Engineered around intentional architectural **trade-offs** (serverless scale-to-zero, AWS-managed encryption, 7-day log retention, and S3/ECR lifecycle rules), it runs both **Dev** and **Prod** environments for **~$1/month** on AWS.

| Persona / Layer           | Core Capabilities                                                                                                                                                                                                                                         | Key Engineering & Safeguards                                                                                                                                                |
| :------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 👀 **Fans & Viewers**     | Sub-second live ball-by-ball scoreboard updates, live win-probability bar on every ball, and interactive AI match chat                                                                                                                                    | WebSocket fan-out (`SNS` → `broadcaster` → `API Gateway WS`) + 3s polling recency guard                                                                                     |
| ✍️ **Scorers**            | **Register**, **Sign In**, or **Continue as Guest**; full match setup (teams, squads, custom overs, toss & Bat/Bowl); 1-tap ball/wicket/extra scoring with **Undo**; live DLS/CRR/RRR equations; AI match summary & deterministic **Player of the Match** | Optimistic UI with ordered `SQS FIFO` persistence + deterministic Cricket MVP Impact Engine (`computePlayerOfTheMatch`) synced across Scorer, Viewer, DB, Email & S3 Backup |
| 🤖 **AI Match Assistant** | One-click starter prompts and free-form Q&A across live stats, tournament PDF rulebooks, hourly match weather, and GitHub issue filing                                                                                                                    | In-memory Model Context Protocol (`InMemoryTransport`) isolating DB/API credentials from the LLM                                                                            |
| 🛡️ **Admins**             | Role-Based Access Control (RBAC), tournament rulebook PDF uploads for `pgvector` RAG, guest/test match cleanup, and automated post-match scorecard emails                                                                                                 | AWS Cognito `Admin` group JWT authorizer (`isAdminClaims`) + Amazon SES HTML scorecard delivery                                                                             |

---

## 🗺️ Architecture at a Glance

Editable Mermaid counterparts live in **[docs/architecture.md](./docs/architecture.md)**, and diagram generator scripts live in **[docs/diagrams/README.md](./docs/diagrams/README.md)**.

### ☁️ 1. Platform Overview

![CricScore platform overview: Route 53, ACM, CloudFront, S3, AWS Amplify, Cognito, IAM, API Gateway, Lambda compute, Aiven PostgreSQL, ECR, SES, CloudWatch, X-Ray, and AWS Budgets](./docs/images/architecture/01_platform_overview.png)

| Tier                            | AWS & Managed Services                                                                                        | Architectural Role & Cost Guardrails                                                                                                                                                                                       |
| :------------------------------ | :------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. DNS, SSL & CDN Edge**      | **Route 53**, **ACM**, **CloudFront (OAC)**, **S3 Static SPA**                                                | Resolves custom domains (`cricscore`, `api.`, `ws.`), provisions free DNS-validated TLS certs, and serves the React 19 SPA with 7-day noncurrent version & 30-day access-log expiration                                    |
| **2. Auth & API Gateway**       | **AWS Amplify Auth**, **Cognito User Pool**, `cognito-presignup` Lambda, **API Gateway (HTTP + WS)**, **IAM** | Handles Sign Up / Sign In / Guest sessions, validates RS256 JWTs at the edge, throttles `/chat` routes (`5 rps`), and enforces least-privilege IAM                                                                         |
| **3. Serverless Compute**       | **AWS Lambda** (`score-update`, `chat-api`, `match-api`, `ml-predict`)                                        | Domain entrypoints for ball ingestion (Diagram 2), Agentic AI (Diagram 3), match CRUD / admin / email / backup ops, and hybrid win probability (Diagram 4)                                                                 |
| **4. Data, Registries & Email** | **Aiven PostgreSQL 16 + `pgvector`**, **Amazon SES**, **Amazon S3**, **Amazon ECR**                           | Stores relational match data & 1536-d rulebook vectors (`dev`/`prod` schemas), emails HTML scorecards, archives match JSON backups (`180d`) + S3 ML models (`models/v2.2.0/`), and hosts the `~309 MB` `xgboost-cpu` image |
| **5. Observability & Cost**     | **CloudWatch Logs & Alarms**, **AWS X-Ray**, **AWS Budgets**                                                  | Enforces 7-day log retention across all log groups, samples traces at `5%`, fires SNS error alerts, and monitors the `~$1/month` AWS budget                                                                                |

### ⚡ 2. Live Scoring: One Ball, Two Parallel Paths

![Live scoring flow: score-update Lambda publishes each ball to SNS for instant WebSocket broadcast and to SQS FIFO for guaranteed persistence in PostgreSQL](./docs/images/architecture/02_live_scoring_flow.png)

| Execution Path                              | Service Pipeline                                                                                                                                  | Latency & Reliability Guarantee                                                       |
| :------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------ |
| **Fast Path (Blue — Spectator Broadcast)**  | `score-update` → **SNS (`match-events`)** → `broadcaster` Lambda → **DynamoDB (`PAY_PER_REQUEST`)** → **API Gateway WebSocket**                   | **`< 1s` real-time push** to all connected viewers without waiting on database writes |
| **Safe Path (Green — Ordered Persistence)** | `score-update` → **SQS FIFO (`storage-buffer.fifo`, `MessageGroupId = matchId`)** → `storage-worker` (`batch_size = 1`) → **Aiven PostgreSQL 16** | **Strict ball-by-ball ordering** and ACID transactional commits per match             |

### 🤖 3. AI Assistant (Autonomous Multi-Agent System via MCP)

![Agentic AI architecture: chat-api Lambda enforces read-only guardrails, injects live match context, and coordinates four specialist MCP agents](./docs/images/architecture/03_ai_assistant.png)

| Specialist Agent                | MCP Tool                  | Backing Service & Security Guardrails                                                                                                                   |
| :------------------------------ | :------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 📊 **Match Stats Agent**        | `execute_sql`             | **Aiven PostgreSQL 16** — `BEGIN READ ONLY` transaction, single-statement `SELECT`/`WITH` AST check, `3s` timeout, `scorer_email` PII stripping         |
| 📖 **Tournament Rules Agent**   | `search_tournament_rules` | **PostgreSQL `pgvector`** — `text-embedding-3-small` cosine similarity search returning top chunks with `[Source: document_name]` citations             |
| 🌦️ **Weather Specialist Agent** | `get_match_weather`       | **Open-Meteo API** — Geocoding + live hourly temperature, rain probability %, wind speed, and Cricket/DLS interruption advisories (no API key required) |
| 🐛 **GitHub Issue Agent**       | `create_github_issue`     | **GitHub Issues REST API** — 2-step user confirmation before filing + server-side rate guard of `1` issue per turn                                      |

### 🧠 4. MLOps & Live Win Probability

![MLOps pipeline: Cricsheet data and DVC tracking feed an 8-model benchmark in MLflow, promoting the XGBoost v2.2.0 champion through CI quality gates to S3 and ECR for real-time hybrid Lambda inference](./docs/images/architecture/04_mlops_win_prediction.png)

| Pipeline Stage                       | Artifact / Component                                                 | Implementation & Cost Optimization                                                                                                                                                                                                                                            |
| :----------------------------------- | :------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Dataset & DVC Lineage**         | `cricket-data/t20s_json.zip.dvc`, `dvc.yaml`, `dvc.lock`             | Tracks raw Cricsheet T20 archives (`~22.7 MB`, `786K+` deliveries) by MD5 hash outside Git history and pins reproducible pipeline stages                                                                                                                                      |
| **2. 8-Model Benchmark**             | `compare_models.py` + **MLflow**                                     | Evaluates 7 Scikit-Learn baselines + **XGBoost** on leakage-free match-grouped splits (`70/15/15`), promoting **XGBoost (`v2.2.0`)** (`Val ROC-AUC = 0.7723`, `Test ROC-AUC = 0.7529`)                                                                                        |
| **3. CI Gate & S3 + ECR Registries** | `mlops-pipeline.yml`, **S3 (`models/v2.2.0/`)**, **ECR (`:v2.2.0`)** | Enforces `Accuracy >= 60%` & `ROC-AUC >= 65%`, uploads `.joblib` (`~227 KB`) + SHA-256 manifest to S3, and builds a `~309 MB` `xgboost-cpu` image in private ECR (required by AWS Lambda) with `countNumber = 1` single-image retention (`~$0.01/mo` beyond 500 MB free tier) |
| **4. Hybrid Lambda Inference**       | `ml-predict` Lambda (`predict.py` + `win_probability.py`)            | Cold-start caches S3 model into `/tmp` with SHA-256 verification (enabling 5-second `--model-version` rollbacks) and blends **XGBoost `v2.2.0`** + **Markov Chain DP** + **DLS Par** on every ball                                                                            |

---

## 🛠️ Technology Stack Summary

| Layer                      | Technologies Used                                                                                                                                                         |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Frontend**               | React 19, TypeScript, Vite, Tailwind CSS, AWS Amplify Auth                                                                                                                |
| **Backend & Messaging**    | Node.js 24.x on AWS Lambda (8 ZIP functions), Amazon API Gateway (HTTP + WebSocket), Amazon SNS, Amazon SQS FIFO, Amazon SES                                              |
| **AI & Agentic RAG**       | OpenAI (`gpt-4o-mini`, `text-embedding-3-small`), Model Context Protocol (`@modelcontextprotocol/sdk`), PostgreSQL `pgvector` (HNSW index), LangGraph (`apps/ai-service`) |
| **MLOps & Win Prediction** | Python 3.12 on AWS Lambda Container (`ml-predict`), `xgboost-cpu` (`v2.2.0`), Scikit-Learn, Pandas, NumPy, MLflow, DVC, Amazon S3 Model Registry, Amazon ECR              |
| **Data & Identity**        | Aiven PostgreSQL 16 (`dev` & `prod` schemas), Amazon DynamoDB (`PAY_PER_REQUEST`), AWS Cognito User Pool (JWT + RBAC)                                                     |
| **Cloud & IaC**            | Terraform (`>= 1.10`), Amazon Route 53, AWS Certificate Manager (ACM), Amazon CloudFront (OAC), Amazon S3, CloudWatch Logs & Alarms, AWS X-Ray, AWS Budgets               |
| **CI/CD & DevSecOps**      | GitHub Actions, GitLeaks, CodeQL (SAST), Trivy (Container & FS), Checkov (Terraform IaC), OWASP ZAP (DAST), Dependabot, Syft SPDX SBOM, Semantic Release                  |
| **Automated Testing**      | **376 Unit/Integration Tests** — Vitest (`151` Frontend + `121` Backend) & Pytest (`75` AI Service + `29` ML Engine) + **Playwright** Cross-Browser E2E                   |

---

## ⚡ Essential Commands Quickstart

```bash
# 1. Install prerequisites & dependencies
./infra/scripts/setup.sh && npm install

# 2. Run local validation (Lint, 376 Unit Tests, Build, Terraform Validate, Checkov, GitLeaks, Trivy, Syft)
./infra/scripts/validate_local.sh --skip-e2e

# 3. Deploy full stack to Dev or Prod (using .env.local)
./infra/scripts/deploy.sh --env dev --use-local-env
./infra/scripts/deploy.sh --env prod --use-local-env
```

---

## 📚 Living Documentation & Tutorials Index

| Domain                          | Core Practices Covered                                                                                     | Step-by-Step Tutorials & Reference Guides                                                                                                                                                                                                                                                                                                       |
| :------------------------------ | :--------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **🚀 Deployment & IaC**         | Self-deployment from scratch, Terraform state locking, GitHub Actions CI/CD, Semantic Release              | **[Full Deployment Guide](./docs/deployment.md)** · **[Terraform Guide](./docs/terraform_guide.md)** · **[GitHub Actions CI/CD](./docs/github_actions.md)** · **[Release Process](./docs/release_process.md)** · **[Aiven DB Setup](./docs/aiven.md)**                                                                                          |
| **⚡ Architecture & Streaming** | Event-driven SNS/SQS fan-out, WebSocket connection registry, Node.js 24 Lambda patterns, REST/WS API spec  | **[Detailed Architecture](./docs/architecture.md)** · **[WebSocket Tutorial](./docs/websocket_tutorial.md)** · **[API Reference](./docs/api.md)** · **[Node.js Lambda Guide](./docs/nodejs_guide.md)** · **[Diagrams Guide](./docs/diagrams/README.md)**                                                                                        |
| **🤖 Agentic AI & MLOps**       | MCP tool isolation, `pgvector` RAG, deterministic POTM, 8-model MLflow benchmark, Markov DP + DLS math     | **[AI & RAG Architecture](./docs/ai_architecture.md)** · **[Architecture & AI FAQ](./docs/architecture_faq.md)** · **[MLOps & DLS Tutorial](./docs/mlops_tutorial.md)** · **[ML Models Handbook](./docs/ml_models_handbook.md)** · **[Weather Agent](./docs/weather_report_agent.md)** · **[GitHub Issue Agent](./docs/github_issue_agent.md)** |
| **🛡️ Security & Cost (~$1/mo)** | Branch protection, Cognito RBAC, 7-scanner DevSecOps gate, `~$1/month` AWS trade-offs, 7-day log retention | **[Cloud Cost & Trade-Offs](./docs/cost_management.md)** · **[Security Posture](./docs/security_posture.md)** · **[Auth & RBAC](./docs/auth.md)** · **[Branch Protection](./docs/branch_protection.md)** · **[Observability & X-Ray](./docs/observability.md)** · **[Scanners & Tools](./docs/tools.md)**                                       |
| **✅ Testing & Operations**     | 376 unit tests + Playwright E2E, production bug RCAs, engineering milestones, live resource dashboards     | **[Testing Tutorial](./docs/testing.md)** · **[Engineering Milestones & Key PRs](./docs/engineering_milestones.md)** · **[Troubleshooting & RCAs](./docs/troubleshooting.md)** · **[Platform Dashboard](./docs/platform_dashboard.md)** · **[Full Changelog](./docs/changelog.md)**                                                             |
