# 🏏 CricScore: Real-Time Cricket Match Engine

[![CI/CD Pipeline](https://github.com/venkatesh-singamsetty/cric-score/actions/workflows/ci.yml/badge.svg)](https://github.com/venkatesh-singamsetty/cric-score/actions/workflows/ci.yml)
[![Production Release](https://img.shields.io/github/v/release/venkatesh-singamsetty/cric-score?label=production&color=success)](https://github.com/venkatesh-singamsetty/cric-score/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Python ML](https://img.shields.io/badge/Python-ML_Engine-blue?logo=python)](https://www.python.org/)
[![Terraform](https://img.shields.io/badge/Terraform-Managed-purple?logo=terraform)](https://www.terraform.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

🚀 **Production Environment:** **https://cricscore.venkateshsingamsetty.com**

🧪 **Development Environment:** **https://cricscoredev.venkateshsingamsetty.com**

👉 **Deployment Details:** **[Full Deployment Guide](./docs/deployment.md)**

⚡ **Quick Commands:** **[Developer Cheatsheet](./CHEATSHEET.md)**

🛠️ **Developer Workflow:** **[Contributing & PR Guide](./CONTRIBUTING.md)**

---

## 🎯 Project Vision

CricScore demonstrates how a high-performance, real-time sports platform can be designed using modern **Multi-Cloud**, **Serverless**, and **Event-Driven** architecture. By combining AWS services with Aiven managed databases, the project maintains an enterprise-grade, cost-optimized footprint.

The project models a live cricket platform featuring:

- **Serverless Compute**: Fully managed AWS Lambda backends.
- **Event-Driven Architecture**: Fan-out messaging via SNS and SQS for fault-tolerant state processing.
- **AI Chat**: Retrieval-augmented answers with Text-to-SQL and vector search.
- **Live MLOps**: On-demand win-probability inference using an AWS Lambda container image stored in ECR.
- **Multi-Cloud Infrastructure**: Terraform-managed deployments bridging AWS and Aiven PostgreSQL.
- **Real-Time Streaming**: WebSocket API Gateway for instant, low-latency score updates.
- **DevSecOps Governance**: End-to-end CI/CD automation with automated security and compliance scanning.

This repository serves as a practical, production-style reference implementation for modern cloud engineering, AI integration, and rigorous operational discipline.

---

## ☁️ 1. Multi-Cloud System Architecture: AWS Serverless & Aiven PostgreSQL

The core application platform leverages a serverless, event-driven multi-cloud design separating high-speed real-time ingestion from relational persistence.

```mermaid
flowchart TD
    %% User and CDN Layer
    Client["Fan / Scorer / Admin (React UI)"] --> Route53["Amazon Route 53 (DNS)"]
    Route53 -.-> CloudFront["AWS CloudFront (CDN)"]
    Route53 -.-> APIGW_HTTP["Amazon API Gateway (HTTP API)"]
    Route53 -.-> APIGW_WS["Amazon API Gateway (WebSocket API)"]

    subgraph Edge ["Frontend Delivery"]
        CloudFront --> S3_App["Amazon S3: Static React Assets"]
    end

    %% Security & Ingress
    subgraph Security ["Identity & Authorization"]
        Cognito["Amazon Cognito User Pool"]
        JWT_Auth["API Gateway Cognito JWT Authorizer"]
        Cognito -->|Token Issuance| Client
        JWT_Auth -.->|Enforces Bearer JWT| APIGW_HTTP
    end

    %% Backend Compute
    subgraph Compute ["AWS Lambda Serverless Compute"]
        MatchAPI["match-api Lambda (Node.js)"]
        ScoreUpdate["score-update Lambda (Node.js)"]
        StorageWorker["storage-worker Lambda (Node.js)"]
        Broadcaster["broadcaster Lambda (Node.js)"]
        ConnHandlers["onconnect / ondisconnect Lambdas"]
        ChatAPI["chat-api Lambda (Node.js Adapter)"]
        MLPredict["ml-predict Lambda (Python 3.12 Docker)"]
        AIService["apps/ai-service (Python 3.12 LangGraph)"]
    end

    %% Asynchronous Fan-Out
    subgraph Messaging ["Event-Driven Fan-Out Ingestion"]
        SNS_Score{{"Amazon SNS: live-score-fanout"}}
        SQS_Queue[["Amazon SQS: persistence-queue"]]
        DDB[("Amazon DynamoDB: WebSocket Connections")]
    end

    %% Multi-Cloud Persistence
    subgraph AivenCloud ["Aiven Managed Cloud Database"]
        AivenPG[("Aiven PostgreSQL 16 + pgvector (dev / prod)")]
    end

    %% External & Auxiliary Services
    subgraph Operations ["Observability & Auxiliary"]
        CloudWatch["CloudWatch Logs (7-day retention) & Alarms"]
        SES["Amazon SES (Match PDF Reports)"]
        S3_Backups[("Amazon S3: Match State Backups")]
        OpenAI["OpenAI-Compatible LLM / Embedding Provider"]
    end

    %% Wire connections
    APIGW_HTTP -->|/match routes| MatchAPI
    APIGW_HTTP -->|POST /update-score| ScoreUpdate
    APIGW_HTTP -->|POST /chat| ChatAPI
    APIGW_HTTP -->|POST /match/predict| MLPredict
    APIGW_WS -->|Connect / Disconnect| ConnHandlers
    ConnHandlers --> DDB

    ScoreUpdate -->|Fast Path Broadcast| SNS_Score
    ScoreUpdate -->|Guaranteed Delivery| SQS_Queue
    SNS_Score --> Broadcaster
    Broadcaster -->|Push Updates| APIGW_WS
    SQS_Queue --> StorageWorker

    MatchAPI --> AivenPG
    StorageWorker -->|Batched Ball Events| AivenPG
    MatchAPI --> SES
    MatchAPI --> S3_Backups

    ChatAPI --> AIService
    AIService -->|Parameterized Read-Only SQL & pgvector| AivenPG
    AIService -.-> OpenAI
```

---

## 🤖 2. Agentic AI, LangGraph Supervisor, RAG & MCP Architecture

CricScore implements a modular Agentic AI platform built on **LangGraph**, **LangChain**, and the **Model Context Protocol (MCP)** with strict read-only security boundaries:

```mermaid
flowchart TD
    subgraph UserInterface ["Frontend & External AI Clients"]
        User["Fan / Viewer (Chat Widget)"]
        Chips["Context-Aware Prompt Chips"]
        LiveContext["Live Match Context Injection"]
        ExtMCP["External AI Clients (Claude Desktop / Cursor)"]
    end

    subgraph SecurityGate ["Ingress & Security Boundary"]
        APIGW_Chat["POST /chat (Open Access for Fans)"]
        NodeAdapter["chat-api Node.js Adapter (Sanitizes History & Enforces Read-Only)"]
    end

    subgraph LangGraphSupervisor ["Python AI Service (LangGraph Supervisor)"]
        Classifier{"Deterministic Intent Router (Zero LLM Latency)"}

        subgraph SpecializedAgents ["Bounded Specialist Agents (Max 3 Tool Calls)"]
            MatchAgent["Match Info Agent (Parameterized SQL, 3s Timeout, Row Limits)"]
            RAGAgent["Cricket RAG Agent (pgvector Cosine Search)"]
            AnalysisAgent["Cricket Analysis Agent (Synthesizes Stats + Rules + DLS)"]
            PredictionAgent["Prediction Agent (Feature Validation & Model Inference)"]
        end

        Synthesizer["Evidence Synthesizer (Untrusted Evidence Quoted, Fact vs Opinion)"]
    end

    subgraph DataAndTools ["Tools & Persistence Layer"]
        PG_Relational[("Aiven PostgreSQL: Matches, Innings, Players")]
        PG_Vector[("pgvector: Tournament Rulebooks Embeddings")]
        ML_Model["cricscore-ml-predict Lambda (Inference Engine)"]
        MCPServer["Python MCP Server (Stdio Transport, 6 Approved Read-Only Tools)"]
    end

    subgraph Observability ["Opt-in Tracing"]
        LangSmith["LangSmith Tracing (Opt-in, Redacted Payloads)"]
    end

    User --> LiveContext
    Chips --> User
    LiveContext --> APIGW_Chat
    APIGW_Chat --> NodeAdapter
    NodeAdapter --> Classifier

    Classifier -->|match_info| MatchAgent
    Classifier -->|rules| RAGAgent
    Classifier -->|analysis| AnalysisAgent
    Classifier -->|prediction| PredictionAgent
    Classifier -->|clarify / refuse| Synthesizer

    MatchAgent -->|Predefined Query| PG_Relational
    RAGAgent -->|Embedding <=> Search| PG_Vector
    AnalysisAgent --> PG_Relational
    AnalysisAgent --> PG_Vector
    PredictionAgent --> ML_Model

    MatchAgent --> Synthesizer
    RAGAgent --> Synthesizer
    AnalysisAgent --> Synthesizer
    PredictionAgent --> Synthesizer

    ExtMCP -.->|Local stdio JSON-RPC| MCPServer
    MCPServer -.-> MatchAgent
    MCPServer -.-> RAGAgent
    MCPServer -.-> PredictionAgent

    Synthesizer -.-> LangSmith
    Synthesizer --> User
```

---

## 🧠 3. Serverless MLOps & Hybrid Win Prediction Architecture

The prediction platform integrates a reproducible **MLOps lifecycle** (DVC + MLflow + GitHub Actions) with a hybrid **Dynamic Programming (DP) + DLS win probability engine**:

```mermaid
flowchart TD
    subgraph DataPipeline ["Phase 1: Dataset Pipeline & DVC Versioning"]
        Cricsheet["Cricsheet Ball-by-Ball JSON Archives"]
        Extractor["data_pipeline.py"]
        RawCSV[("live_data.csv (786K+ Deliveries)")]
        DVC_Track["DVC Tracking: cricket-data/t20s_json.zip.dvc & dvc.yaml"]
        Cricsheet --> Extractor --> RawCSV --> DVC_Track
    end

    subgraph Experimentation ["Phase 2: Multi-Algorithm Experimentation & Leakage-Free Validation"]
        Splitter["Match-Grouped Split (70% Train, 15% Val, 15% Test: Zero Leakage)"]

        subgraph Candidates ["Candidate Algorithm Benchmark"]
            LogReg["LogisticRegression (Baseline)"]
            HGB["HistGradientBoostingClassifier"]
            RF["RandomForestClassifier"]
            ET["ExtraTreesClassifier"]
        end

        Metrics["Evaluation Metrics: Log Loss, Brier Score, ROC-AUC, Accuracy, Latency"]
        MLflowStore[("Local MLflow Store: apps/ml-engine/mlruns/")]

        RawCSV --> Splitter --> Candidates --> Metrics --> MLflowStore
    end

    subgraph Governance ["Phase 3: Promotion Gates & Manifest Generation"]
        Gate{"Quality Gates: Accuracy >= 0.60 & ROC-AUC >= 0.65?"}
        Winner["Promoted Winner: HistGradientBoosting"]
        Manifest["model_manifest.json (Semantic Version, Metrics, SHA-256 Checksum)"]
        Report["comparison_report.md (Markdown Benchmark Table)"]

        Metrics --> Gate
        Gate -->|Approved| Winner --> Manifest --> Report
    end

    subgraph Automation ["Phase 4: CI/CD Automation (GitHub Actions)"]
        WorkflowA["Workflow A: mlops-pipeline.yml (Train, Benchmark & Validate)"]
        WorkflowB["Workflow B: ml-model-release.yml (Promote, S3 Publish & Instant Rollback)"]
        ECR["Amazon ECR Container Registry"]
    end

    subgraph Serving ["Phase 5: Real-Time Hybrid Inference (AWS Lambda)"]
        LambdaContainer["cricscore-ml-predict Lambda (Python 3.12 Container)"]
        SafeLoader["Safe SHA-256 Checksum Loader & MODEL_VERSION Routing"]

        subgraph HybridEngine ["Format-Agnostic Probability Engine (1–20 Overs)"]
            FirstInn["1st Innings: Par-RPO Projection Logistic Curve"]
            SecondInn["2nd Innings: Hybrid Markov DP Simulation + DLS Resource Par"]
            TerminalCheck["Terminal State Evaluator (0% / 100% Certainty Check)"]
        end

        Manifest --> WorkflowA
        WorkflowA --> WorkflowB
        WorkflowB -->|Deploy / Rollback| ECR --> LambdaContainer
        LambdaContainer --> SafeLoader --> TerminalCheck --> FirstInn
        TerminalCheck --> SecondInn
    end
```

---

## 🛠️ Technology Stack

### Frontend

| Technology   | Purpose                                       |
| ------------ | --------------------------------------------- |
| React        | User interface framework                      |
| TypeScript   | Type-safe application development             |
| Vite         | Frontend build tooling and development server |
| HTML5 / CSS3 | UI structure and styling                      |

### Backend & APIs

| Technology                  | Purpose                              |
| --------------------------- | ------------------------------------ |
| AWS Lambda                  | Serverless backend execution         |
| Amazon API Gateway          | REST API and WebSocket communication |
| AWS Cognito                 | Identity management and JWT auth     |
| AWS Amplify Auth            | Frontend auth SDK (sign-up/sign-in)  |
| Amazon SNS                  | Event fan-out messaging              |
| Amazon SQS                  | Asynchronous worker queues           |
| Node.js 24.x                | High performance runtime             |
| OpenAI-compatible providers | Foundation models for RAG            |
| MCP SDK                     | Model Context Protocol architecture  |

### Database

| Technology       | Purpose                                              |
| ---------------- | ---------------------------------------------------- |
| Aiven PostgreSQL | Managed relational database                          |
| PostgreSQL       | Match, player, score, and tournament persistence     |
| pgvector         | Vector similarity search extension for RAG           |
| HNSW Index       | High-performance approximate nearest-neighbor search |
| DynamoDB         | NoSQL active connections registry for WebSockets     |

### Machine Learning & MLOps

| Technology     | Purpose                                         |
| -------------- | ----------------------------------------------- |
| Python 3.10    | MLOps workflow and ML Lambda container runtime  |
| Scikit-Learn   | Logistic Regression model for win probability   |
| Pandas / NumPy | High-performance data manipulation and matrices |
| AWS ECR        | Docker container registry for Serverless ML     |
| Joblib         | Model serialization and artifact packaging      |

### Infrastructure & Cloud

| Technology | Purpose                        |
| ---------- | ------------------------------ |
| Terraform  | Infrastructure as Code         |
| AWS Cloud  | Cloud infrastructure platform  |
| CloudFront | Global content delivery        |
| S3         | Static website hosting         |
| Route53    | DNS management                 |
| ACM        | SSL/TLS certificate management |
| SES        | Simple Email Service reports   |
| CloudWatch | Logging, Metrics, and Alarms   |
| AWS X-Ray  | Distributed request tracing    |
| Budgets    | Automated billing alerts       |

### DevSecOps & Security

| Tool            | Purpose                               |
| --------------- | ------------------------------------- |
| GitHub Actions  | CI/CD automation                      |
| Checkov         | Terraform security scanning           |
| GitLeaks        | Secret detection                      |
| Trivy           | Dependency and vulnerability scanning |
| OWASP ZAP       | Dynamic application security testing  |
| Dependabot      | Dependency vulnerability monitoring   |
| SBOM Generation | Software supply chain visibility      |

### Testing

| Tool                  | Purpose                           |
| --------------------- | --------------------------------- |
| Vitest                | JavaScript/TypeScript test runner |
| Pytest                | Python ML Engine testing          |
| React Testing Library | Frontend component testing        |
| Playwright            | End-to-end browser automation     |

---

## 🏢 Engineering Practices & Technical Documentation

CricScore is structured to demonstrate production-oriented engineering practices across the nine areas below. The linked guides provide additional technical details and tradeoffs.

### 1. 🛡️ DevSecOps & Security

**Identity & Automated Scanning**
Authenticated HTTP API routes use **AWS Cognito JWT authorization**. CI runs GitLeaks, Checkov, Trivy filesystem scans, and application and infrastructure validation; a separate CodeQL workflow analyzes code. CI does not run `npm audit`. OWASP ZAP scans deployed environments, but its configured action does not fail the workflow on findings.

- 📖 **[Authentication & Authorization](./docs/auth.md)**: Cognito SSO flows, guest mode, admin user management, JWT validation, and cross-session identity guard.
- 📖 **[Security Posture & Tradeoffs](./docs/security_posture.md)**: Defense in depth strategy, multi-tenant isolation, and encryption layers.
- 📖 **[Branch Protection & Governance](./docs/branch_protection.md)**: Branch protection rules and repository governance guidance.
- 📖 **[Contributing & Developer Workflow](./CONTRIBUTING.md)**: Branch workflow, Git hooks, and local validation commands.

### 2. 🔭 Observability & Logging

**System Visibility**
Lambda logs are sent to CloudWatch Logs. AWS X-Ray sampling is configured with a 5% fixed sampling rate and a one-request-per-second reservoir. CloudWatch alarms send SNS email alerts for errors from the match API and score-update Lambdas.

- 📖 **[Observability Suite](./docs/observability.md)**: CloudWatch Logs, X-Ray tracing, CloudWatch alarms and SNS alerts, plus optional Sentry/Uptime setup.
- 📖 **[Cost & Performance](./docs/cost_management.md)**: Cost monitoring guidance and architecture scale limits.
- 📖 **[Central Resources & Artifacts Dashboard](./docs/aws_resources_dashboard.md)**: Automated single-pane-of-glass directory featuring live Dev & Prod AWS console deep links, ECR container images, XGBoost ML artifacts, Aiven PostgreSQL vector schemas, and security scan reports.

### 3. ✅ Rigorous Testing

**Multi-Layer Testing**
Vitest tests cover frontend and backend code, and the ML engine has Pytest coverage. Playwright end-to-end tests run against the deployed development environment on main-branch deployments and against Production during production deployment; pull requests do not run the deployed-site E2E suite.

- 📖 **[Testing Guide](./docs/testing.md)**: Vitest and Playwright test commands, Availability Testing (Chaos/DR), and E2E structures.
- 📖 **[Toolchain & Security Stack](./docs/tools.md)**: Master list of all CI/CD, IaC, and AppSec tools used in the pipeline.

### 4. ♾️ Event-Driven Processing

**Event-Driven Design**
The score-update flow uses SNS fan-out: updates are broadcast to connected clients and buffered in a FIFO SQS queue for database persistence. The configured queue retains messages for up to one day. A dead-letter queue is not configured in the current Terraform.

- 📖 **[Detailed Architecture](./docs/architecture.md)**: System design, sequence flows, and EDA logic.
- 📖 **[API Guide](./docs/api.md)**: REST & WebSocket contract specifications.
- 📖 **[Aiven Managed Services](./docs/aiven.md)**: PostgreSQL database configuration and keep-alive strategy.
- 📖 **[Node.js Guide](./docs/nodejs_guide.md)**: ESM vs CommonJS standardizations and dependency security.

### 5. 🏗️ Infrastructure as Code (IaC)

**Versioned & Repeatable Environments**
The AWS infrastructure is codified in Terraform. Changes can be planned, scanned for infrastructure security issues by Checkov, and applied through GitHub Actions or the local deploy script, reducing manual infrastructure changes.

- 📖 **[Full Deployment & Infrastructure](./docs/deployment.md)**: Step-by-step setup of accounts, tools, AWS, Aiven and OpenAI, then Dev and Prod deploys.
- 📖 **[Troubleshooting](./docs/troubleshooting.md)**: Setup fixes and identity verification help.

### 6. 🚀 CI/CD Automation

**Pull Request Validation & Tagged Releases**
Pull requests to `main` run validation jobs; deployed-site E2E tests are not part of the pull-request run. A successful CI run on `main` can create a semantic-versioned release when the commits meet the configured release rules. The development workflow deploys and tests Dev on `main`; the separate production workflow deploys on version tags or can be manually dispatched with a selected tag. Redeploying an older tag is possible, but is not an instant rollback and should account for database/schema compatibility.

- 📖 **[GitHub Actions Architecture](./docs/github_actions.md)**: CI/CD Directory structure constraints and pipeline organization.
- 📖 **[Automated Releases](./docs/release_process.md)**: Semantic release and Conventional Commit specifications.
- 📖 **[Full Project Log](./docs/changelog.md)**: Release records and development timeline.

### 7. 🤖 Agentic AI & RAG

**AI Chat with Retrieval-Augmented Generation**
CricScore includes an **AI Chat Assistant** that uses an OpenAI-compatible API; its default inference and embedding model names are `gpt-4o-mini` and `text-embedding-3-small`, and provider/model settings can be configured. MCP tools handle database operations so database credentials are not passed to the model provider. Retrieval uses up to eight pgvector chunks, and responses include cricket rulebook guidance. Model availability, output quality, and request cost depend on the configured provider and settings.

- 📖 **[AI Architecture](./docs/ai_architecture.md)**: RAG design, MCP architecture, provider configuration, quality tuning, and example prompts.

### 8. 🧠 Serverless MLOps & Live Prediction

**Win Probability Inference**
CricScore includes a model-training workflow and a win-probability inference Lambda. The inference model evaluates match-state features such as runs, wickets, target score, and balls remaining. Terraform builds and pushes the inference Lambda's Docker image to **AWS ECR**; the GitHub MLOps workflow separately tests, trains, evaluates, and uploads model artifacts. On-demand Lambda execution avoids an always-on inference server, but AWS usage and ECR storage may still incur costs.

- 📖 **[MLOps & Prediction Guide](./docs/mlops_tutorial.md)**: Training workflow and inference deployment, [Win Prediction Specification](./docs/mlops_tutorial.md#-8-win-prediction-engine-specification) (par-RPO scaling, RRR caps, wicket sensitivity), and [DLS Method](./docs/mlops_tutorial.md#️-9-duckworth-lewis-stern-dls-method) (ICC resource decay, par-score calculations).

### 9. 🤖 AI Agent Governance & Skills

CricScore includes repository-specific instructions and an **AI Skills Library** to guide coding assistants. The tools' support for automatically loading these files varies.

The `.agents/skills/` directory contains focused, on-demand guidance for:

- Pull-request code review and review findings
- Secure implementation and validation
- Branch, PR, CI/CD, and developer-command workflows
- AWS cost and Terraform/infrastructure changes
- Frontend, backend, and AI/RAG architecture
- Node.js, browser, and ML testing
- ML training and inference compatibility
- PostgreSQL schema changes and migrations

### 🔌 Agent Guidance Integration

These skills are Markdown files; an agent can use them when its host is configured to load or access repository files. Markdown format alone does not make them load automatically in every AI tool:

- **Cursor**: The repository includes a `.cursorrules` guidance file.
- **GitHub Copilot**: The repository includes `.github/copilot-instructions.md` guidance.
- **MCP clients**: An agent with an appropriate filesystem tool can read the files; MCP compatibility by itself does not load or follow them.
