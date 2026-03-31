# 🏗️ Architecture: Live Event-Driven Scoring Engine

CricScore is built on a high-concurrency, **Event-Driven Architecture (EDA)** where every ball event is a persistent record in **Aiven PostgreSQL** and a real-time broadcast via **Aiven Kafka**.

## 🔄 System Overview & Infrastructure Journey
```mermaid
graph TD
    User((User Browser)) -->|1. Path/Link| CF[CloudFront CDN]
    CF -->|2. Fetch Frontend| S3[S3 Static Website]
    
    subgraph Browser_Environment [CricScore Client]
        User
        React[React / Vite App]
        React -->|3. URL Hub| AppID[Deep-Link matchId]
    end
    
    CF -.->|4. Load Bundle| User
    React -->|5. HTTP API| APIGW_REST[API Gateway - REST]
    React -->|6. Real-time| APIGW_WS[API Gateway - WebSocket]
    
    subgraph Backend_Cloud [AWS / Aiven Hybrid Stack]
        APIGW_REST --> Lambda_API[Match API Lambda]
        APIGW_WS --> Lambda_WS[Broadcaster Lambda]
        
        Lambda_API --> PG[(Aiven PostgreSQL)]
        Lambda_WS -->|7. Find Fans| DDB[(DynamoDB Registry)]
        Lambda_API -.->|8. Admin Log| SES[AWS SES]
    end
    
    Lambda_API -->|9. Score Event| Kafka{Aiven Kafka mTLS}
    Kafka -->|10. Fan Stream| Lambda_WS
```

---

## 🏛️ Technical Pillars & Specifications
CricScore implements a high-performance **Event-Driven Architecture (EDA)** using 100% serverless and managed services:

- **Dual-Write Integrity:** Performs atomic ACID transactions in **Aiven PostgreSQL** for history while simultaneously publishing to **Aiven Kafka** for real-time propagation.
- **mTLS Security:** Hardened, certificate-based encryption for all Kafka traffic using serverless certificate injection.
- **Zero-Latency Broadcast:** Achieves sub-100ms global score delivery using an asynchronous broadcaster lambda and AWS WebSocket API Gateway.
- **State Restoration (v1.5.2):** Automated deep-link hydration for instant bypass-routing to active match scoreboards via UUID-anchored URLs.
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

---

## 🔄 Detailed Sequence Flows

### 1. ⚡ Live Score Update (Dual-Write)
```mermaid
sequenceDiagram
    autonumber
    actor Scorer as Scorer
    participant Lambda_Score as Score Update Lambda
    participant Aiven_PG as Aiven PostgreSQL
    participant Aiven_Kafka as Aiven Kafka
    participant Lambda_Broadcast as Broadcaster Lambda
    participant WS as WebSocket Gateway
    actor Spectator as Spectators

    Scorer->>Lambda_Score: POST /update-score
    rect rgb(0, 0, 0, 0.1)
        Lambda_Score->>Aiven_PG: UPDATE innings & balls
        Lambda_Score->>Aiven_Kafka: Publish (mTLS)
    end
    Lambda_Score-)Lambda_Broadcast: InvokeAsync
    Lambda_Broadcast->>DDB: Scan active connections
    DDB-->>Lambda_Broadcast: Return Connection IDs
    Lambda_Broadcast->>WS: PostToConnection
    WS-->>Spectator: Live Update Rendered
```

### 2. 📊 Fetch Match Details (Deep-Link Hydration)
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

### 3. 🛡️ Security Strategy
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
