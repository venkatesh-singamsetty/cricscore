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

## 🔄 System Architecture

To keep the data flow easy to follow, the architecture is split into two views:

1. **Real-Time Scoring & Decoupled Fan-Out Flow** — What happens on every ball scored (the sub-100ms spectator broadcast path vs. the durable database persistence path).
2. **Platform Ecosystem (Edge, Auth, AI RAG, MLOps & Observability)** — How static delivery, Cognito authentication, Agentic AI Chat (MCP), Serverless ML Win Prediction, and CloudWatch/X-Ray monitoring fit together.

### 1. ⚡ Real-Time Scoring & Decoupled Fan-Out Flow

```mermaid
flowchart LR
    Scorer(["🏏 Scorer Console\n(React SPA)"])
    Spectators(["🌍 Live Spectators\n(Viewer Scoreboard)"])

    subgraph Ingest ["1. Authenticated Ingest"]
        HTTP_GW["API Gateway\n(HTTP API + Cognito JWT)"]
        ScoreUpd["score-upd Lambda\n(Event Producer)"]
    end

    subgraph FastPath ["2A. Fast Broadcast Path (<100ms)"]
        SNS{{"AWS SNS Topic\n(match-events)"}}
        Broadcaster["broadcaster Lambda"]
        DDB[("DynamoDB\nActive Connections")]
        WS_GW["API Gateway\n(WebSocket API)"]
    end

    subgraph ReliablePath ["2B. Durable Persistence Path (Async)"]
        SQS[["AWS SQS FIFO\n(storage-buffer.fifo)"]]
        Worker["storage-worker Lambda\n(Batch Size = 1)"]
        PG[("Aiven PostgreSQL\n(matches, innings,\nplayers, balls)")]
    end

    Scorer -->|"POST /match/{id}/score\n(explicitTotalRuns, ballData)"| HTTP_GW
    HTTP_GW --> ScoreUpd

    ScoreUpd -->|"1. Publish live event"| SNS
    SNS -->|"Async invoke"| Broadcaster
    Broadcaster <-->|"Lookup active sockets"| DDB
    Broadcaster -->|"Push @connections"| WS_GW
    WS_GW ==>|"Instant WebSocket push"| Spectators

    ScoreUpd -->|"2. Enqueue FIFO record"| SQS
    SQS -->|"Ordered trigger"| Worker
    Worker -->|"ACID SQL transaction"| PG
```

**How a Single Ball Flows End-to-End:**

1. **Ingest (`score-upd`)**: The Scorer taps a run, extra, wicket, or undo button. `MatchView` sends the ball payload (including authoritative `explicitTotalRuns`, `explicitTotalWickets`, and `ballData.batterName`) to `POST /match/{id}/score`.
2. **Fast Path (SNS $\rightarrow$ WebSocket)**: `score-upd` publishes to **AWS SNS**, which immediately invokes `broadcaster`. The broadcaster reads active spectator connection IDs from **DynamoDB** and pushes the update through **API Gateway WebSockets** to every watching fan in real time.
3. **Durable Path (SQS FIFO $\rightarrow$ PostgreSQL)**: In parallel, `score-upd` enqueues the event into **AWS SQS FIFO** (`MessageGroupId = matchId`), guaranteeing strict ball-by-ball ordering as `storage-worker` writes to **Aiven PostgreSQL** without ever blocking the Scorer UI.

---

### 2. 🏛️ Platform Ecosystem (Edge, Auth, AI RAG, MLOps & Observability)

```mermaid
flowchart TB
    Users(["👤 Fans, Scorers & Admins"])

    subgraph Edge ["Edge Delivery & Identity"]
        R53["Amazon Route 53 + ACM TLS"]
        CF["AWS CloudFront CDN"]
        S3_App["Amazon S3\n(React Frontend Bundle)"]
        Cognito["Amazon Cognito User Pool\n(JWT Auth + Pre-Signup Trigger)"]
    end

    subgraph APIs ["Serverless Application Tier (API Gateway + AWS Lambda)"]
        MatchAPI["match-api Lambda\n(Match CRUD, Admin Ops, Email)"]
        ChatAPI["chat-api Lambda\n(Agentic RAG + In-Process MCP)"]
        MLPredict["ml-predict Lambda\n(Hybrid Markov DP + DLS + Scikit-Learn)"]
        ECR["Amazon ECR\n(ML Docker Image)"]
    end

    subgraph DataAndAI ["Managed Data, Storage & External AI"]
        PG_Main[("Aiven PostgreSQL\nRelational + pgvector HNSW")]
        S3_Backup[("Amazon S3\n(Match Backups)")]
        SES["Amazon SES\n(Match Summary Emails)"]
        LLM["OpenAI API\n(gpt-4o-mini + text-embedding-3-small)"]
    end

    subgraph Ops ["Observability & Cost Governance"]
        CW["CloudWatch Logs (7-Day Retention)\n& Error Metric Alarms"]
        XRay["AWS X-Ray\n(Distributed Tracing)"]
        Alerts["SNS Email Alerts\n& AWS $5/mo Budget"]
    end

    Users -->|"HTTPS"| R53
    R53 --> CF --> S3_App
    Users -.->|"Sign-Up / Sign-In / Guest JWT"| Cognito

    R53 -->|"REST API"| MatchAPI & ChatAPI & MLPredict
    ECR -.->|"Container image"| MLPredict

    MatchAPI -->|"CRUD & Hydration"| PG_Main
    MatchAPI -->|"JSON Snapshot"| S3_Backup
    MatchAPI -->|"HTML Scorecard"| SES

    ChatAPI <-->|"pgvector RAG + Read-Only SQL"| PG_Main
    ChatAPI <-->|"Tool-calling & Embeddings"| LLM

    MatchAPI & ChatAPI & MLPredict -.->|"Logs, Metrics & Traces"| CW & XRay
    CW --> Alerts
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
- 📖 **[AWS Resources Dashboard](./docs/aws_resources_dashboard.md)**: Script-generated AWS resource inventory with console links.

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
