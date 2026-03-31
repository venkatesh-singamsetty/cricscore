# 🏗️ Architecture: Live Event-Driven Scoring Engine

CricScore is built on a high-concurrency, **Event-Driven Architecture (EDA)** where every ball event is a persistent record in **Aiven PostgreSQL** and a real-time broadcast via **Aiven Kafka**.

---

## 🔄 Detailed Sequence Flows (v2.0 Fan-Out)

### 1. 📊 Fetch Match Details (Deep-Link Hydration)
```mermaid
sequenceDiagram
    autonumber
    actor Viewer as Fan / Spectator
    participant App as React App
    participant Lambda as Match API Lambda
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
    participant Producer as Match Producer (Lambda)
    participant SNS as AWS SNS (Event Hub)
    participant Broadcaster as Broadcaster (Lambda)
    participant SQS as AWS SQS (Storage Buffer)
    participant Consumer as Storage Worker (Lambda)
    participant Aiven_Hub as Aiven Data Hub (PG/Kafka)

    Scorer->>Producer: POST /update-score
    Producer->>SNS: Publish Match Event
    Producer-->>Scorer: HTTP 200 OK (Instant)
    
    rect rgb(0, 0, 0, 0.1)
        SNS-)Broadcaster: Fast-Path Invoke (WebSockets)
    end
    
    rect rgb(0, 100, 0, 0.1)
        SNS->>SQS: Buffer for Reliability
        SQS-)Consumer: Asynch Ingest
        Consumer->>Aiven_Hub: Commit PG & Publish Kafka
    end
```

## 🔄 System Overview & Infrastructure Journey (v2.0)
```mermaid
graph TD
    User((User)) -->|1. Path| CF[CloudFront]
    CF -->S3[S3 Website]
    
    subgraph UI_Layer [CricScore Client]
        React[React / Vite App]
    end
    
    React -->|2. REST| APIGW_REST[API Gateway]
    React -->|3. Real-time| APIGW_WS[API Gateway - WS]
    
    subgraph Cloud_Orchestration [AWS Fan-Out]
        APIGW_REST --> Producer[Producer Lambda]
        Producer --> SNS{AWS SNS Topic}
        
        SNS -->|4. Fast Broadast| Broadcaster[Broadcaster Lambda]
        SNS -->|5. Reliability Buffer| SQS[[AWS SQS Queue]]
        SQS -->|6. Storage| Consumer[Storage Lambda]
    end
    
    subgraph Managed_Data [Aiven Data Hub]
        Consumer --> PG[(Aiven PostgreSQL)]
        Consumer --> Kafka((Aiven Kafka mTLS))
    end
    
    Kafka --> Broadcaster
    Broadcaster --> APIGW_WS
```

---

## 🏛️ Technical Pillars & Specifications
CricScore implements a high-performance **Event-Driven Architecture (EDA)** using 100% serverless and managed services:

- **Decoupled Fan-Out (v2.0):** Leverages AWS SNS for instant UI responses and AWS SQS for asynchronous background persistence to Aiven PostgreSQL and Kafka.
- **mTLS Security:** Hardened, certificate-based encryption for all Kafka traffic using serverless certificate injection.
- **Zero-Latency Broadcast:** Achieves sub-100ms global score delivery using an asynchronous broadcaster lambda driven instantly by SNS.
- **State Restoration (v2.0):** Automated deep-link hydration for instant bypass-routing to active match scoreboards via UUID-anchored URLs.
- **Secure Isolation:** Enterprise-grade multi-tenant scoring engine with **VITE_ADMIN_PIN** record governance.

---

## 🏛️ Component Breakdown

### **1. Official Scorer (The Implementation)**
*   **Match Registry**: Games are anchored to a unique, non-sequentially generated UUID provided by the **Aiven PostgreSQL** registry during initialization.
*   **State Persistence**: ACID-compliant transactions ensure that innings, scores, and historical ball records are atomically committed.
*   **Administrative Archival**: AWS SES is integrated to provide official match-day record logging, delivering board-verified score summaries to the administrator for historical auditing.

### **2. Managed Fan Hub (The Discovery Engine)**
*   **Discovery Gateway**: Fan clients browse active games via a real-time match hub fetching from the Aiven repository.
*   **WebSocket Hub**: Sub-second socket propagation via **AWS WebSocket Gateway** with the connection registry managed in **DynamoDB**.
*   **Deep-Link System**: Zero-friction URL-restoration logic for immediate spectator bypass-routing (v1.5.2).

### 3. **Security Strategy**
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
