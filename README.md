# 🏏 CricScore: Real-Time Cricket Match Engine

🚀 **Production Environment:** **https://cricscore.venkateshsingamsetty.com**

🧪 **Development Environment:** **https://cricscoredev.venkateshsingamsetty.com**

👉 **Deployment Details:** **[Full Deployment Guide](./docs/deployment.md)**

🛠️ **Developer Workflow:** **[Contributing & PR Guide](./CONTRIBUTING.md)**

---

## 🎯 Project Vision

CricScore demonstrates how a production-style real-time sports platform
can be designed using modern cloud-native, DevOps, security, and
reliability engineering practices while maintaining a cost-optimized
architecture.

The project models a live cricket platform with:

- fans viewing match updates in real time
- authorized scorers recording ball-by-ball events
- event-driven backend processing
- Terraform-managed cloud infrastructure
- security and observability built into deployment
- CI/CD automation for repeatable releases

This repository is a practical production-style reference implementation for
cloud-native app delivery, AI integration, and operational discipline.

---

## 🔄 System Architecture (Fan-Out)

```mermaid
graph TD
    %% Global CDN Layer
    subgraph CDN [Global Delivery]
        CF[AWS CloudFront] --> S3[AWS S3: React App]
    end

    %% Cloud Logic
    subgraph AWS [AWS Serverless Stack]
        REST_GET[API Gateway: GET] --> match_api[match-api Lambda]

        REST_POST[API Gateway: POST] --> score_update[score-upd Lambda]
        score_update --> SNS{AWS SNS Topic}

        %% Consumer logic
        SNS -->|Reliability| SQS[[AWS SQS Queue]]
        SQS --> storage_worker[storage-worker Lambda]

        SNS -->|Fast-Path| broadcaster[broadcaster Lambda]

        %% WebSocket Gateway Hub
        WS_GW[API Gateway: WebSockets] -->|1. Trigger| onConnect[onconnect Lambda]
        WS_GW -->|1. Trigger| onDisconnect[ondisconnect Lambda]

        onConnect -->|2. Register| DDB[(DynamoDB Registry)]
        onDisconnect -->|2. Prune| DDB

        broadcaster -->|3. Data Push| WS_GW
        WS_GW -->|4. Stream| Fan
    end

    %% Data Hub vertically stacked for clear routing
    subgraph Aiven [Aiven Managed Data Hub]
        PG[(Aiven PostgreSQL)]
    end

    %% Explicit data routing
    match_api -->|Initial Setup| PG
    storage_worker -->|ACID Commit| PG

    %% User Interaction Labels
    Fan((Fan)) -.->|Request| REST_GET
    Fan -.->|Handshake| WS_GW
    Scorer((Scorer)) -.->|Post| REST_POST
```

---

## 🚀 Deployment

Use the canonical deployer for each environment:

```bash
# Development
./infra/scripts/deploy.sh --env dev

# Production
./infra/scripts/deploy.sh --env prod
```

This script applies the correct Terraform environment, regenerates the frontend
runtime values from live AWS outputs, builds the app, uploads it to S3, and
invalidates CloudFront so the dev and prod sites stay isolated.

### 🔐 One-Time Setup for a Fresh Clone

Before the first deployment, make sure you have the required local values ready:

- AWS credentials configured for the target account
- Terraform installed locally
- Aiven PostgreSQL connection string for the environment you want to deploy
- OpenRouter or OpenAI API key for the LLM layer
- SES sender email and admin email configured in the environment variables
- A hosted domain or Route 53 zone already created if you plan to use the public
  site URLs

A typical local setup is:

```bash
cp .env.local.example .env.local
# fill in the required AWS / database / LLM values before running the deploy script
```

If your repo does not include a `.env.local.example`, use the values already
referenced by the infra scripts and Terraform variables as the source of truth.

### 💰 Cost Notes

The recurring cost is expected to stay very low for normal usage. In practice, the
main fixed monthly expense is typically the Route 53 hosted zone, while most other
services are event-driven or usage-based. If you are not actively testing the dev
site, you can destroy or pause it to keep costs near the minimum possible level.

### 🤖 AI & RAG

CricScore includes a production-style **AI Chat Assistant** powered by:

| Capability                | Implementation                                                 |
| ------------------------- | -------------------------------------------------------------- |
| **MCP tools**             | Secure tool execution with credentials kept inside the backend |
| **Text-to-SQL**           | LLM-generated read-only SQL for live match and stats questions |
| **Vector RAG**            | `pgvector` search over uploaded tournament rule PDFs           |
| **LLM provider**          | OpenRouter with `gpt-4o-mini` and `text-embedding-3-small`     |
| **Environment isolation** | `DB_SCHEMA` keeps dev and prod data separated                  |

A lightweight AI evaluation baseline is included under `evals/` to monitor tool choice, safety, and answer quality for the chat assistant.

---

# 🛠️ Technology Stack

## Frontend

| Technology   | Purpose                                       |
| ------------ | --------------------------------------------- |
| React        | User interface framework                      |
| TypeScript   | Type-safe application development             |
| Vite         | Frontend build tooling and development server |
| HTML5 / CSS3 | UI structure and styling                      |

---

## Backend & APIs

| Technology          | Purpose                              |
| ------------------- | ------------------------------------ |
| AWS Lambda          | Serverless backend execution         |
| Amazon API Gateway  | REST API and WebSocket communication |
| AWS Cognito         | Identity management and JWT auth     |
| AWS Amplify Auth    | Frontend auth SDK (sign-up/sign-in)  |
| Amazon SNS          | Event fan-out messaging              |
| Amazon SQS          | Asynchronous worker queues           |
| Node.js 24.x        | High performance runtime             |
| OpenRouter / OpenAI | Foundation Models for Agentic RAG    |
| MCP SDK             | Model Context Protocol architecture  |

---

## Database

| Technology       | Purpose                                              |
| ---------------- | ---------------------------------------------------- |
| Aiven PostgreSQL | Managed relational database                          |
| PostgreSQL       | Match, player, score, and tournament persistence     |
| pgvector         | Vector similarity search extension for RAG           |
| HNSW Index       | High-performance approximate nearest-neighbor search |

---

## Infrastructure & Cloud

| Technology | Purpose                        |
| ---------- | ------------------------------ |
| Terraform  | Infrastructure as Code         |
| AWS Cloud  | Cloud infrastructure platform  |
| CloudFront | Global content delivery        |
| S3         | Static website hosting         |
| Route53    | DNS management                 |
| ACM        | SSL/TLS certificate management |

---

## DevSecOps & Security

| Tool            | Purpose                               |
| --------------- | ------------------------------------- |
| GitHub Actions  | CI/CD automation                      |
| Checkov         | Terraform security scanning           |
| GitLeaks        | Secret detection                      |
| Trivy           | Dependency and vulnerability scanning |
| OWASP ZAP       | Dynamic application security testing  |
| Dependabot      | Dependency vulnerability monitoring   |
| SBOM Generation | Software supply chain visibility      |

---

## Testing

| Tool                  | Purpose                       |
| --------------------- | ----------------------------- |
| Vitest                | Unit testing framework        |
| React Testing Library | Frontend component testing    |
| Playwright            | End-to-end browser automation |

---

# 🤖 AI Architecture

See the **[Full AI Architecture Guide](./docs/ai_architecture.md)** for a complete deep-dive.

## MCP Tools

The `chat-api` Lambda implements the **Model Context Protocol (MCP)** with two registered tools:

| Tool                      | Type            | Purpose                                                                                           |
| ------------------------- | --------------- | ------------------------------------------------------------------------------------------------- |
| `execute_sql`             | Text-to-SQL RAG | Writes & executes READ-ONLY SQL to answer live score, player stats, and historical data questions |
| `search_tournament_rules` | Vector RAG      | Embeds the user query and performs cosine-similarity search against the uploaded PDF rulebook     |
| `delete_match`            | Admin Action    | Deletes one, multiple, or all matches from the database (Admin JWT required)                      |
| `deleteGuestData`         | Admin Action    | Finds and deletes all Cognito guest accounts and their match records (Admin JWT required)         |

## AI File Structure

```
apps/backend/lambdas/chat-api/
├── index.js                      ← Thin Lambda router (entry point)
├── config/
│   ├── db.js                     ← Shared PostgreSQL pool + setSearchPath (dev/prod aware)
│   └── llm.js                    ← Shared OpenAI client, model & embedding config
├── handlers/
│   ├── chatHandler.js            ← Agentic MCP chat loop (main AI pipeline)
│   ├── summaryHandler.js         ← AI post-match summary generation
│   └── uploadRulesHandler.js     ← PDF text extraction + batch embedding ingestion
└── mcp/
    ├── server.js                 ← MCP Server (tool registry)
    └── tools/
        ├── executeSql.js         ← Text-to-SQL tool (READ ONLY, 3s timeout)
        ├── searchRules.js        ← Vector cosine-similarity search tool
        ├── deleteMatch.js        ← Admin match deletion tool (JWT-gated)
        └── deleteGuestData.js    ← Admin guest account purge tool (JWT-gated)
```

## Required Environment Variables

| Variable       | Description                          | Example                        |
| -------------- | ------------------------------------ | ------------------------------ |
| `LLM_API_KEY`  | OpenRouter or OpenAI API key         | `sk-or-v1-...`                 |
| `LLM_BASE_URL` | LLM provider base URL                | `https://openrouter.ai/api/v1` |
| `LLM_MODEL`    | _(Optional)_ Override model name     | `gpt-4o-mini`                  |
| `DATABASE_URL` | Aiven PostgreSQL connection string   | `postgres://...`               |
| `DB_SCHEMA`    | Environment schema (`dev` or `prod`) | `dev`                          |

> **Security:** All credentials are loaded inside the MCP Server/tools only. The LLM (OpenRouter) **never** receives `DATABASE_URL` or `LLM_API_KEY` — it only sees tool schemas and query results.

---

# 🏢 Enterprise-Grade Standards & Technical Documentation

CricScore is structured to demonstrate production-oriented engineering practices across 6 core pillars of enterprise architecture. All technical decisions, tradeoffs, and deep-dives are documented in their respective guides below.

### 1. 🛡️ DevSecOps & Security

**Zero-Trust Identity & Automated Scanning**
The platform is designed around **AWS Cognito JWT-based authentication**, API Gateway JWT Authorizers, and multi-tenant data isolation. The CI/CD pipeline can act as an automated gatekeeper, blocking PRs that fail GitLeaks, Trivy, Checkov, CodeQL, or OWASP ZAP.

- 📖 **[Authentication & Authorization](./docs/auth.md)**: Cognito SSO flows, guest mode, admin user management, JWT validation, and cross-session identity guard.
- 📖 **[Security Posture & Tradeoffs](./docs/security_posture.md)**: Defense in depth strategy, multi-tenant isolation, and encryption layers.
- 📖 **[Branch Protection & Governance](./docs/branch_protection.md)**: Strict 8 required status checks, zero direct pushes to `main`, and administrator enforcement.
- 📖 **[Contributing & Developer Workflow](./CONTRIBUTING.md)**: Step-by-step feature branch workflow, Git Hooks (`pre-push`), and full local validation commands (`validate_local.sh`).

### 2. 🔭 Observability & Logging

**Total System Visibility**
The platform is instrumented to stream structured JSON logs to CloudWatch. AWS X-Ray can be used for distributed tracing across API Gateway, SNS, SQS, and Lambda to pinpoint latency bottlenecks. Critical failure metrics can trigger automated SNS alerts.

- 📖 **[Observability Suite](./docs/observability.md)**: CloudWatch Dashboards, X-Ray Tracing, Sentry Crash Reporting, and Uptime monitors.
- 📖 **[Cost & Performance](./docs/cost_management.md)**: Free-tier monitoring strategy and architecture scale limits.
- 📖 **[AWS Resources Dashboard](./docs/aws_resources_dashboard.md)**: Automatically generated, real-time index of every single deployed AWS resource with deep-links to the console.

### 3. ✅ Rigorous Testing

**Multi-Layer Test Pyramid**
Code is intended to be validated at every tier: Unit tests evaluate isolated Lambda functions, API tests validate REST contracts, and Playwright can execute E2E user journey tests against the staging environment.

- 📖 **[Testing Guide](./docs/testing.md)**: Vitest and Playwright test commands, Availability Testing (Chaos/DR), and E2E structures.
- 📖 **[Toolchain & Security Stack](./docs/tools.md)**: Master list of all CI/CD, IaC, and AppSec tools used in the pipeline.

### 4. ♾️ High Availability & Reliability

**Fault-Tolerant Event-Driven Design**
The architecture decouples the frontend from backend persistence using SNS fan-out and SQS queuing. If the database experiences downtime, the queue-based pattern is designed to retain and replay work with retry and dead-letter handling.

- 📖 **[Detailed Architecture](./docs/architecture.md)**: System design, sequence flows, and EDA logic.
- 📖 **[API Guide](./docs/api.md)**: REST & WebSocket contract specifications.
- 📖 **[Aiven Managed Services](./docs/aiven.md)**: PostgreSQL database configuration and keep-alive strategy.
- 📖 **[Node.js Guide](./docs/nodejs_guide.md)**: ESM vs CommonJS standardizations.

### 5. 🏗️ Infrastructure as Code (IaC)

**Immutable & Reproducible Environments**
The AWS infrastructure is codified in Terraform. Changes can be planned, validated for security drift by Checkov, and applied through GitHub Actions or the deploy script to reduce manual click-ops errors.

- 📖 **[Full Deployment & Infrastructure](./docs/deployment.md)**: Local preview, bootstrap foundations, and AWS/Aiven Setup.
- 📖 **[Troubleshooting](./docs/troubleshooting.md)**: Setup fixes and identity verification help.

### 6. 🤖 Agentic AI & RAG

**Production-style AI with MCP Security Boundaries**
The AI chat system implements the Model Context Protocol to enforce a clear security boundary between the LLM and the database. Tool execution, credential access, and query validation are designed to remain inside the MCP server boundary rather than being exposed directly to the provider.

- 📖 **[AI Architecture](./docs/ai_architecture.md)**: Full Agentic RAG design, MCP architecture diagram, troubleshooting log (13 documented bugs & fixes), educational AI concepts, and cost breakdown.

### 7. 🚀 CI/CD Automation

**Pipeline Governance**
Merge requests to `main` are designed to require passing status checks. The deployment pipeline can automatically build the Vite frontend, synchronize S3 buckets, invalidate CloudFront caches, package Lambdas, and execute semantic version releases in a controlled, repeatable way.

- 📖 **[GitHub Actions Architecture](./docs/github_actions.md)**: CI/CD Directory structure constraints and pipeline organization.
- 📖 **[Automated Releases](./docs/release_process.md)**: Semantic release and Conventional Commit specifications.
- 📖 **[Full Project Log](./docs/changelog.md)**: Release records and development timeline.

---

# 🤖 AI Assisted Development

AI tools were used as productivity accelerators for:

- Code suggestions
- Documentation generation
- Test creation assistance
- Troubleshooting
- Architecture brainstorming
