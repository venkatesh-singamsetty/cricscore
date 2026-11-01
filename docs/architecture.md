# 🏗️ Architecture: Live Event-Driven Scoring Engine

CricScore is built on a high-concurrency, **Event-Driven Architecture (EDA)** where every ball event is a persistent record in **Aiven PostgreSQL** and a real-time broadcast via **AWS API Gateway WebSockets**, operating at **~$1/month** across `dev` and `prod` combined.

---

## 🗺️ System Diagrams (Mermaid)

Editable, text-based versions of the platform diagrams. The icon-based PNG/SVG diagrams shown in the main [README](../README.md) are generated via [`docs/diagrams/generate_architecture_diagrams.py`](./diagrams/generate_architecture_diagrams.py).

```bash
# Regenerate all 3 high-resolution architecture diagrams (PNG + SVG)
python3 docs/diagrams/generate_architecture_diagrams.py
```

### ☁️ 1. Multi-Cloud System Architecture: AWS Serverless & Aiven PostgreSQL

The core application platform leverages a serverless, event-driven multi-cloud design separating high-speed real-time ingestion from relational persistence.

```mermaid
flowchart TD
    %% User and CDN Layer
    Client["Fan / Scorer / Admin (React 19 SPA)"] --> Route53["Amazon Route 53 (DNS)"]
    Route53 --> ACM["AWS Certificate Manager (TLS Certs)"]
    ACM --> CloudFront["Amazon CloudFront (CDN + OAC)"]
    ACM --> APIGW_HTTP["Amazon API Gateway (HTTP REST API)"]
    ACM --> APIGW_WS["Amazon API Gateway (WebSocket API)"]

    subgraph Edge ["1. DNS, SSL & CDN Edge"]
        CloudFront --> S3_App["Amazon S3: Static React SPA & Access Logs (7d/30d Lifecycle)"]
    end

    %% Security & Ingress
    subgraph Security ["2. Auth (AWS Amplify + Cognito) & IAM"]
        Amplify["AWS Amplify Auth SDK & UI"]
        Cognito["AWS Cognito User Pool (JWT + RBAC)"]
        PreSignup["cognito-presignup Lambda (Guest Auto-Confirm)"]
        IAM["AWS IAM (Least-Privilege Roles)"]
        Client --> Amplify --> Cognito --> PreSignup
        Cognito -.->|JWT Authorizer| APIGW_HTTP
    end

    %% Backend Compute
    subgraph Compute ["3. AWS Lambda Serverless Compute"]
        MatchAPI["match-api Lambda (Node.js 24)"]
        ScoreUpdate["score-update Lambda (Node.js 24)"]
        StorageWorker["storage-worker Lambda (Node.js 24)"]
        Broadcaster["broadcaster Lambda (Node.js 24)"]
        ConnHandlers["onconnect / ondisconnect Lambdas"]
        ChatAPI["chat-api Lambda (Node.js 24 + In-Memory MCP)"]
        MLPredict["ml-predict Lambda (Python 3.12 Container)"]
    end

    %% Asynchronous Fan-Out
    subgraph Messaging ["Event-Driven Fan-Out Ingestion (Diagram 2)"]
        SNS_Score{{"Amazon SNS: match-events"}}
        SQS_Queue[["Amazon SQS FIFO: storage-buffer.fifo"]]
        DDB[("Amazon DynamoDB: WebSocket Connections")]
    end

    %% Multi-Cloud Persistence & Registries
    subgraph DataLayer ["4. Data, Registries & Email"]
        AivenPG[("Aiven PostgreSQL 16 + pgvector (dev / prod schemas)")]
        SES["Amazon SES (Scorecard Emails)"]
        S3_Backups[("Amazon S3: Match Backups (180d), ML Model Registry & TF State")]
        ECR["Amazon ECR: xgboost-cpu Image (~309 MB, 1-Image Retention)"]
    end

    %% External & Observability Services
    subgraph Operations ["5. Observability, Tracing, Cost & External APIs"]
        CloudWatch["CloudWatch Logs (7d Retention) & Alarms + SNS"]
        XRay["AWS X-Ray (5% Trace Sampling)"]
        Budgets["AWS Budgets (~$1/mo Alert)"]
        OpenAI["OpenAI-Compatible LLM & Embeddings"]
        OpenMeteo["Open-Meteo Weather API"]
        GitHubAPI["GitHub Issues REST API"]
    end

    %% Wire connections
    APIGW_HTTP -->|/match & /admin| MatchAPI
    APIGW_HTTP -->|POST /update-score| ScoreUpdate
    APIGW_HTTP -->|POST /chat & /chat/summary| ChatAPI
    APIGW_HTTP -->|POST /match/predict| MLPredict
    APIGW_WS -->|$connect / $disconnect| ConnHandlers
    ConnHandlers --> DDB

    ScoreUpdate -->|Fast Path Broadcast| SNS_Score
    ScoreUpdate -->|Ordered Persistence| SQS_Queue
    SNS_Score --> Broadcaster
    MatchAPI -->|Direct Invoke: HUB_UPDATE| Broadcaster
    Broadcaster --> DDB
    Broadcaster -->|Push Live Frames| APIGW_WS
    SQS_Queue --> StorageWorker

    MatchAPI --> AivenPG
    StorageWorker -->|Transactional Ball Writes| AivenPG
    MatchAPI --> SES
    MatchAPI --> S3_Backups

    ECR -->|Container Runtime| MLPredict
    S3_Backups -->|Versioned Model v2.2.0| MLPredict

    ChatAPI -->|Read-Only SQL & pgvector RAG| AivenPG
    ChatAPI -.-> OpenAI
    ChatAPI -.-> OpenMeteo
    ChatAPI -.-> GitHubAPI
```

---

### 🤖 2. Agentic AI, MCP & Specialist Multi-Agent Architecture

CricScore implements a modular Agentic AI platform built on **Model Context Protocol (MCP)**, **LangGraph**, and **LangChain** with strict read-only security boundaries and domain-bounded specialist agents:

```mermaid
flowchart TD
    subgraph UserInterface ["Frontend & External AI Clients"]
        User["Fan / Viewer (Chat Widget)"]
        Chips["Context-Aware Prompt Chips"]
        LiveContext["Live Match Context Injection (Telemetry)"]
        ExtMCP["External AI Clients (Claude Desktop / Cursor)"]
    end

    subgraph SecurityGate ["Ingress & Security Boundary"]
        APIGW_Chat["POST /chat (Open Access for Fans)"]
        NodeAdapter["chat-api Node.js Lambda (Orchestrator, Sanitizes History & Enforces Read-Only)"]
    end

    subgraph AgentSupervisor ["Agent Supervisor & Specialist Agents (Node.js & Python LangGraph)"]
        Classifier{"Deterministic Intent Router (Zero LLM Latency)"}

        subgraph SpecializedAgents ["6 Bounded Specialist Agents (Max 3 Tool Calls)"]
            MatchAgent["📊 Match Stats Agent (Parameterized SQL, 3s Timeout, Row Limits)"]
            RAGAgent["📖 Tournament Rules RAG Agent (pgvector Cosine Search)"]
            WeatherAgent["🌦️ Match Weather Agent (Open-Meteo API, No Key Required)"]
            IssueAgent["🐛 GitHub Issue Agent (GitHub REST API, 2-Step Confirmation)"]
            AnalysisAgent["🏏 Cricket Context & Tactical Agent (Live Telemetry + DLS + Pacing)"]
            PredictionAgent["🎯 Win Prediction Agent (Feature Validation & Model Inference)"]
        end

        Synthesizer["Evidence Synthesizer (Untrusted Evidence Quoted, Fact vs Opinion)"]
    end

    subgraph DataAndTools ["Tools, Persistence & External APIs"]
        PG_Relational[("Aiven PostgreSQL: Matches, Innings, Players")]
        PG_Vector[("pgvector: Tournament Rulebooks Embeddings")]
        ML_Model["cricscore-ml-predict Lambda (Inference Engine)"]
        WeatherAPI["Open-Meteo Weather API (Public API, No Key Required)"]
        GitHubAPI_Tool["GitHub REST API (Issue Creation)"]
        MCPServer["In-Memory MCP Server & Python Stdio (Tool Schema Registry)"]
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
    Classifier -->|weather| WeatherAgent
    Classifier -->|bug / feature| IssueAgent
    Classifier -->|analysis| AnalysisAgent
    Classifier -->|prediction| PredictionAgent
    Classifier -->|clarify / refuse| Synthesizer

    MatchAgent -->|Predefined Query| PG_Relational
    RAGAgent -->|Embedding <=> Search| PG_Vector
    WeatherAgent -->|Geocoding + Forecast| WeatherAPI
    IssueAgent -->|Authenticated Issue Creation| GitHubAPI_Tool
    AnalysisAgent --> PG_Relational
    AnalysisAgent --> PG_Vector
    AnalysisAgent --> LiveContext
    PredictionAgent --> ML_Model

    MatchAgent --> Synthesizer
    RAGAgent --> Synthesizer
    WeatherAgent --> Synthesizer
    IssueAgent --> Synthesizer
    AnalysisAgent --> Synthesizer
    PredictionAgent --> Synthesizer

    ExtMCP -.->|Local stdio JSON-RPC| MCPServer
    MCPServer -.-> MatchAgent
    MCPServer -.-> RAGAgent
    MCPServer -.-> WeatherAgent
    MCPServer -.-> IssueAgent
    MCPServer -.-> PredictionAgent

    Synthesizer -.-> LangSmith
    Synthesizer --> User
```

#### Complete Specialist Agent & Tool Inventory

| #     | Specialist Agent                          | Capability / MCP Tool                   | Source & Technology         | Key Features & Guardrails                                                                                                                                                                |
| :---- | :---------------------------------------- | :-------------------------------------- | :-------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | 📊 **Match Stats Agent**                  | `execute_sql`                           | Aiven PostgreSQL 16         | • Strict read-only `SELECT` enforcement<br/>• Blocks write/DDL keywords (`DROP`, `DELETE`, `UPDATE`)<br/>• 3-second statement timeout                                                    |
| **2** | 📖 **Tournament Rules RAG Agent**         | `search_tournament_rules`               | `pgvector` store (Aiven PG) | • Cosine similarity search on PDF chunks<br/>• Proportional powerplay scaling for shortened overs<br/>• Strict citation: `[Source: document_name]`<br/>• Anti-hallucination truthfulness |
| **3** | 🌦️ **Weather Specialist Agent**           | `get_match_weather`                     | Open-Meteo API              | • Geocoding + hourly forecasts<br/>• Rain probability %, temp, wind speed<br/>• Cricket & DLS rain advisories<br/>• Public API (no API key required)                                     |
| **4** | 🐛 **GitHub Issue Reporter Agent**        | `create_github_issue`                   | GitHub REST API             | • Creates labeled issues (`via-cricscore-ai`, category)<br/>• 2-step confirmation to capture title & description<br/>• Rate-limited: max 1 issue per turn                                |
| **5** | 🏏 **Cricket Context & Tactical Agent**   | Live match context injection            | Real-time scoreboard state  | • Analyzes CRR vs RRR equations<br/>• Match phase analysis (Powerplay / Middle / Death)<br/>• Evaluates bowler overs and matchup strategy without extra DB queries                       |
| **6** | 🎯 **Win Probability & Prediction Agent** | `predict_match_outcome` / direct Lambda | XGBoost + Markov DP + DLS   | • Validates 8 situational features<br/>• Blends ML gradient boosting with dynamic programming<br/>• Produces probabilistic percentages and conversational commentary                     |

---

### 🧠 3. Serverless MLOps & Hybrid Win Prediction Architecture

The prediction platform integrates a reproducible **MLOps lifecycle** (DVC + MLflow + GitHub Actions) with a hybrid **Dynamic Programming (DP) + DLS win probability engine**:

```mermaid
flowchart TD
    subgraph DataPipeline ["Phase 1: Dataset Pipeline & DVC Lineage"]
        Cricsheet["Cricsheet T20 Ball-by-Ball Archives (786K+ Deliveries)"]
        Extractor["data_pipeline.py (live_data.csv Extraction)"]
        DVC_Track["DVC Lineage: cricket-data/t20s_json.zip.dvc, dvc.yaml & dvc.lock"]
        Cricsheet --> Extractor --> DVC_Track
    end

    subgraph Experimentation ["Phase 2: Multi-Algorithm Benchmark & Champion Selection"]
        Splitter["Match-Grouped Split (70% Train / 15% Val / 15% Test — Zero Leakage)"]
        Benchmark["compare_models.py: 8-Model Benchmark (7 Sklearn Baselines + XGBoost)"]
        MLflowStore[("MLflow Experiment Store (ROC-AUC, Log Loss, Brier Score)")]
        Winner["Promoted Champion: XGBoost v2.2.0 (Val AUC 0.772, Test AUC 0.753)"]

        DVC_Track --> Splitter --> Benchmark --> MLflowStore --> Winner
    end

    subgraph Governance ["Phase 3: CI Quality Gate & Dual S3 + ECR Registries"]
        Gate{"CI Quality Gate (mlops-pipeline.yml): Acc >= 60% & ROC-AUC >= 65%"}
        Manifest["model_manifest.json (Semantic Version + SHA-256 Checksum)"]
        S3Registry[("Amazon S3 Model Registry: models/v2.2.0/ (.joblib ~227 KB)")]
        ECR["Amazon ECR: xgboost-cpu Image (~309 MB, countNumber = 1 Single Image)"]

        Winner --> Gate
        Gate -->|Approved| Manifest
        Manifest --> S3Registry
        Manifest --> ECR
    end

    subgraph Serving ["Phase 4: Real-Time Hybrid Inference (AWS Lambda)"]
        LambdaContainer["ml-predict Lambda (Python 3.12, 1024 MB, /tmp SHA-256 Verified Cache)"]
        HybridEngine["Hybrid Win Engine: XGBoost v2.2.0 + Markov DP Simulation + DLS Par"]

        S3Registry -->|Cold-Start Pull & SHA-256 Verify| LambdaContainer
        ECR -->|Container Runtime| LambdaContainer
        LambdaContainer --> HybridEngine
    end
```

---

## 🔄 Detailed Sequence Flows (Fan-Out)

### 1. 📊 Fetch Match Details (Deep-Link Hydration)

```mermaid
sequenceDiagram
    autonumber
    actor Viewer as Fan / Spectator
    participant App as React App
    participant Lambda as match-api Lambda
    participant Aiven_PG as Aiven PostgreSQL

    Viewer->>App: Visit Link (?matchId=xxx)
    App->>App: useEffect: Read ID from URL
    App->>Lambda: GET /match/{id}/details
    rect rgb(0, 0, 0, 0.1)
        Lambda->>Aiven_PG: SELECT matches, innings, players, balls
    end
    Lambda-->>App: Return Unified State
    App-->>Viewer: Render Scoreboard
```

### 2. ⚡ Live Score Update (Decoupled Fan-Out)

```mermaid
sequenceDiagram
    autonumber
    actor Scorer as Scorer
    participant Producer as score-upd Lambda
    participant SNS as AWS SNS (Event Hub)
    participant Broadcaster as broadcaster Lambda
    participant DDB as DynamoDB (Connections)
    participant APIGW_WS as API Gateway (WebSockets)
    actor Viewer as Fan / Spectator

    participant SQS as AWS SQS (Storage Buffer)
    participant Consumer as storage-worker (Lambda)
    participant Aiven_Hub as Aiven PostgreSQL

    Scorer->>Producer: POST /update-score
    Producer->>SNS: Publish Match Event
    Producer->>SQS: Enqueue Persistence Event
    Producer-->>Scorer: HTTP 200 after both sends succeed

    rect rgb(0, 0, 0, 0.1)
        Note right of SNS: Spectator Broadcast
        SNS-)Broadcaster: SNS Invoke (Fast-Path)
        Broadcaster->>DDB: Scan Connection Registry
        DDB-->>Broadcaster: Return Connection[]
        Broadcaster->>APIGW_WS: POST @connections (Fan-Out)
        APIGW_WS-->>Viewer: Live UI State Update
    end

    rect rgb(100, 100, 100, 0.1)
        Note right of SQS: Asynchronous Data Persistence
        SQS-)Consumer: Pull/Trigger Batch
        Consumer->>Aiven_Hub: Pg SQL Save
    end
```

---

## 🏛️ Technical Pillars & Specifications

| Technical Pillar                        | Implementation File(s)                                                     | Mechanism & Guarantee                                                                                                                                                              |
| :-------------------------------------- | :------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decoupled Fan-Out**                   | `score-update/index.js`, `broadcaster/index.js`, `storage-worker/index.js` | Publishes to **AWS SNS** (`match-events`) for instant `<50ms` WebSocket fan-out while enqueuing into **AWS SQS FIFO** (`storage-buffer.fifo`) for ordered PostgreSQL writes.       |
| **Authoritative Cumulative State**      | `App.tsx`, `storage-worker/index.js`, `LiveScoreboard.tsx`                 | Every `POST /update-score` payload sends `explicitTotalRuns`, `explicitTotalWickets`, and `ballData.batterName`, keeping DB and UI synchronized across strike rotations and undos. |
| **WebSocket vs. Polling Recency Guard** | `LiveScoreboard.tsx` (`lastWsUpdateRef`)                                   | Suppresses background REST poll overwrites for `3 seconds` after any WebSocket push so a lagging read never reverts a live boundary or wicket.                                     |
| **Idempotent Innings & Match Sync**     | `match-api/index.js`, `storage-worker/index.js`                            | `POST /match/{id}/innings` uses `ON CONFLICT (match_id, inning_number) DO UPDATE` and resolves optimistic `inn2_<timestamp>` IDs to the canonical PostgreSQL `inning_id`.          |
| **Deterministic Player of the Match**   | `chat-api/handlers/summaryHandler.js` (`computePlayerOfTheMatch`)          | Computes Cricket MVP Impact Score deterministically (batting runs, team share, `4s`/`6s`, SR vs match RPO, wickets, economy, maidens, `1.35x + 5.0` win bonus) and caches in DB.   |
| **X-Ray Distributed Tracing**           | `infra/terraform/xray.tf`, `infra/terraform/lambda.tf`                     | Active tracing enabled on all 8 Lambdas with a `5%` fixed sampling rate and a `1 req/sec` reservoir (`cricscore-low-cost-5pct`) to stay within AWS X-Ray Free Tier.                |
| **Scoring & Admin Authorization**       | `infra/terraform/apigw.tf`, `match-api/index.js` (`isAuthorized`)          | Cognito JWT Authorizer protects write/admin routes at API Gateway; `match-api` verifies resource ownership (`scorer_email`) or Cognito `Admin` group membership.                   |

---

## 🔐 Authentication & Role Model

> See [`docs/auth.md`](./auth.md) for the full authentication specification.

| Role          | Identity Mechanism                                    | Frontend Capabilities                                          | Backend Authorization (`API Gateway` + `Lambda`)                                          |
| :------------ | :---------------------------------------------------- | :------------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| **Viewer 🌍** | Public UUID link (no sign-in required)                | View live scoreboards, full scorecards, and AI Chat            | Open `GET /matches`, `GET /match/{id}/details`, `POST /chat`, `POST /match/predict`       |
| **Guest 🎮**  | Shadow Cognito account (`guest-{ts}@cricscore.local`) | Score practice matches; auto-confirmed via `cognito-presignup` | Valid Cognito JWT; isolated guest records can be bulk-pruned by Admins                    |
| **Scorer 🎮** | Verified Cognito User Pool account                    | Create matches, score ball-by-ball, undo, email reports        | Valid Cognito JWT + per-match ownership check (`matches.scorer_email == jwt.email`)       |
| **Admin ⚡**  | Cognito `Admin` group / `ADMIN_REPORT_EMAIL`          | Full Match Ops Admin Panel, user management, PDF rules         | Valid Cognito JWT + `cognito:groups` includes `Admin` (or super-admin email verification) |

---

## 🧩 Platform Component Breakdown

| Subsystem                           | AWS / Cloud Components                                         | Key Files                                                               | Primary Responsibilities                                                                                                                                              |
| :---------------------------------- | :------------------------------------------------------------- | :---------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Official Scorer Engine**       | `score-update` Lambda, SNS, SQS FIFO, Cognito                  | `apps/frontend/src/App.tsx`, `apps/backend/lambdas/score-update/`       | Initializes UUID matches, validates ball-by-ball deliveries, publishes to SNS/SQS, and isolates sessions via `prevEmailRef` identity guard.                           |
| **2. Managed Fan Hub**              | `match-api` Lambda, `broadcaster` Lambda, DynamoDB, WebSockets | `apps/backend/lambdas/match-api/`, `apps/backend/lambdas/broadcaster/`  | Serves live match discovery, deep-link hydration, `HUB_UPDATE` broadcasts, WebSocket connection registry (`$connect`/`$disconnect`), and Admin Panel.                 |
| **3. Storage Buffer Worker**        | `storage-worker` Lambda, SQS FIFO, Aiven PostgreSQL 16         | `apps/backend/lambdas/storage-worker/index.js`                          | Drains ordered FIFO batches (`MessageGroupId = matchId`) and executes transactional SQL updates for `matches`, `innings`, `players`, `bowlers`, `ball_events`.        |
| **4. Security & Identity**          | AWS Cognito User Pool, `cognito-presignup` Lambda, IAM         | `infra/terraform/cognito.tf`, `infra/terraform/iam.tf`                  | Enforces least-privilege IAM roles, JWT route protection, `isAuthorized()` ownership checks, TLS PostgreSQL connections, and guest shadow isolation.                  |
| **5. Infrastructure & CI/CD**       | Terraform, S3 State, GitHub Actions (`ci.yml`, `cd.yml`)       | `infra/scripts/setup.sh`, `infra/scripts/deploy.sh`, `infra/terraform/` | Automates bootstrapping, dynamic `.env.local` hydration into `TF_VAR_*`, dev deployments on `main`, and production releases on `v*` tags.                             |
| **6. Agentic AI & MCP Assistant**   | `chat-api` Lambda (Node.js 24), `apps/ai-service` (LangGraph)  | `apps/backend/lambdas/chat-api/`, `apps/ai-service/cricscore_ai/`       | Runs in-memory MCP Server + 6 specialist agents (SQL Stats, `pgvector` Rules RAG, Open-Meteo Weather, GitHub Issue Reporter, Tactical Context, Win Predictor).        |
| **7. Serverless MLOps & Predictor** | `ml-predict` Lambda, Amazon ECR (`xgboost-cpu`), S3 Registry   | `apps/ml-engine/compare_models.py`, `apps/ml-engine/predict.py`         | Tracks 786K+ Cricsheet deliveries via DVC, benchmarks 8 models in MLflow, serves **XGBoost (`v2.2.0`)** + Markov DP + DLS from S3/ECR (`~309 MB`, `countNumber = 1`). |

---

## 🛠️ Quick Verification Commands

```bash
# 1. Validate Terraform infrastructure configuration
./infra/scripts/terraform.sh validate

# 2. Run all backend, frontend, AI service, and ML engine test suites
npm --prefix apps/backend test -- --run
npm --prefix apps/frontend test -- --run
./apps/ai-service/.venv/bin/pytest apps/ai-service -q
./apps/ai-service/.venv/bin/pytest apps/ml-engine/tests -q

# 3. Deploy full stack to dev using local environment variables
./infra/scripts/deploy.sh --env dev --use-local-env
```

---

© 2026 CricScore Documentation. 🏎️🏆🏛️🛡️🏁🚀
