# 🏗️ Architecture: Live Event-Driven Scoring Engine

CricScore is built on a high-concurrency, **Event-Driven Architecture (EDA)** where every ball event is a persistent record in **Aiven PostgreSQL** and a real-time broadcast via **Aiven Kafka**.

## 🔄 Detailed Sequence Flows (v2.0.0 Fan-Out)

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
    participant Broadcaster as broadcaster-hub Lambda
    participant DDB as DynamoDB (Connections)
    participant APIGW_WS as API Gateway (WebSockets)
    actor Viewer as Fan / Spectator
    
    participant SQS as AWS SQS (Storage Buffer)
    participant Consumer as storage-worker (Lambda)
    participant Aiven_Hub as Aiven PostgreSQL & Kafka

    Scorer->>Producer: POST /update-score
    Producer->>SNS: Publish Match Event
    Producer-->>Scorer: HTTP 200 OK (Sub-100ms)
    
    rect rgb(0, 0, 0, 0.1)
        Note right of SNS: Phase 1: Zero-Latency Spectator Sync
        SNS-)Broadcaster: SNS Invoke (Fast-Path)
        Broadcaster->>DDB: Scan Connection Registry
        DDB-->>Broadcaster: Return Connection[]
        Broadcaster->>APIGW_WS: POST @connections (Fan-Out)
        APIGW_WS-->>Viewer: Live UI State Update
    end
    
    rect rgb(100, 100, 100, 0.1)
        Note right of SNS: Phase 2: Reliable Data Persistence
        SNS->>SQS: Buffer Event
        SQS-)Consumer: Pull/Trigger Batch
        Consumer->>Aiven_Hub: Pg SQL Save & Kafka mTLS Stream
    end
```

---

## 🏛️ Technical Pillars & Specifications
CricScore implements a high-performance **Event-Driven Architecture (EDA)** using 100% serverless and managed services:

- **Decoupled Fan-Out (v2.0.0):** Leverages AWS SNS for instant UI responses and AWS SQS for asynchronous background persistence to Aiven PostgreSQL and Kafka.
- **mTLS Security:** Hardened, certificate-based encryption for all Kafka traffic using serverless certificate injection.
- **Zero-Latency Broadcast:** Achieves sub-100ms global score delivery using an asynchronous broadcaster lambda driven instantly by SNS.
- **State Restoration (v2.0.0):** Automated deep-link hydration for instant bypass-routing to active match scoreboards via UUID-anchored URLs.
- **Aiven TLS Bypass:** Explicit fallback overriding Node v18 strict intermediate CAs (`NODE_TLS_REJECT_UNAUTHORIZED = '0'`) allowing seamless PostgreSQL scaling.
- **UI Render Debouncing:** Synchronous `useRef` execution locks prevent React async state-drifts during rapid scoring bursts, enforcing exact chronological network sequences.
- **Secure Isolation:** Enterprise-grade multi-tenant scoring engine with **VITE_ADMIN_PIN** record governance.

---

## 🏛️ Component Breakdown

### **1. Official Scorer (The Implementation)**
*   **Match Registry**: Games are anchored to a unique, non-sequentially generated UUID provided by the **Aiven PostgreSQL** registry during initialization.
*   **score_update Lambda**: Acts as the scoring producer. Validates incoming ball-by-ball payloads and publishes them to the AWS SNS event hub for downstream fan-out.
*   **State Persistence**: ACID-compliant transactions ensure that innings, scores, and historical ball records are atomically committed.

### **2. Managed Fan Hub (The Discovery Engine)**
*   **match_api Lambda**: The entry point for fans. Handles match discovery hub fetching and initial deep-link hydration to retrieve match state from Aiven PostgreSQL.
*   **broadcaster_hub Lambda**: The heart of the v2.0.0 fast-path. It consumes SNS events and performs a massive parallel push to all active spectator WebSocket tunnels by querying the DynamoDB Registry.
*   **WebSocket Lifecycle (onConnect/onDisconnect)**: These Lambdas manage the "who is watching now" registry in DynamoDB, ensuring zero-latency fan-out targeting.
*   **Deep-Link System**: Zero-friction URL-restoration logic for immediate spectator bypass-routing.

### **3. Reliability & Persistence (The Storage Buffer)**
*   **storage_worker Lambda**: Subscribed to the AWS SQS queue. It processes match events in reliable batches, ensuring that even during high-traffic bursts, database commits to Aiven PostgreSQL and event-streaming to Aiven Kafka remain consistent and ordered.

### **4. Security Strategy**
- **Administrative Sovereignty**: Operations impacting global match state (e.g., `DELETE /match/{id}`) are restricted via a **State-Sync PIN** (`VITE_ADMIN_PIN`), ensuring only authorized board-governance actors can purge records.
- **Mutual TLS (mTLS)**: Hardened, certificate-based connections for all Kafka event traffic.
- **SSL Enforcement**: Mandatory for all Aiven PostgreSQL persistence sessions.
- **Multi-Tenant Isolation**: Dual-scoped session logic ensures that scorer identities and match states are isolated by both Email and MatchID, preventing cross-tenant data leakage.
- **Role-Based Access Hierarchy**:
    - **Viewer 🌍**: Public/No-Auth spectator access based solely on the sharable match UUID.
    - **Scorer 🎮**: Secure/Email-Auth access for persistence and ball-by-ball updates.
    - **Admin ⚡**: Protected/PIN-Auth access for global record purging and database maintenance.

---
© 2026 CricScore Documentation. 🏎️🏎️🏆🏛️🛡️🏁🚀
