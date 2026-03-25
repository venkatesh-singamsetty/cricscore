# 🏏 CricScore: Real-Time Cricket Match Engine
### 🏆 Aiven Free Tier Competition Entry (#AivenFreeTier)

[![Aiven](https://img.shields.io/badge/Aiven-Managed%20Services-blue)](https://aiven.io)
[![AWS](https://img.shields.io/badge/AWS-Serverless-orange)](https://aws.amazon.com)
[![Kafka](https://img.shields.io/badge/Kafka-Event%20Streaming-black)](https://kafka.apache.org)

CricScore is a highly performant, serverless cricket engine designed for sub-second match updates. It leverages **Aiven PostgreSQL** for persistence, **Aiven Kafka** for event streaming, and **AWS Lambdas/WebSockets** for global real-time broadcasting.

---

## 🏆 Why Aiven? (A Competition Journey)
This project was built to solve the "Live Score Lag" problem using **100% Open Source and Free Tier services**. By combining **Aiven for PostgreSQL** and **Aiven for Apache Kafka**, we've achieved a true **Event-Driven Architecture (EDA)** that stays within free-tier limits while providing enterprise-grade features:

- **Dual-Write Integrity:** We use Aiven PG as our "Master of Record" for historical ball events and Aiven Kafka as our "Fast-Path Stream" for sub-second spectator updates.
- **mTLS Security (Hardened Hands-on):** Unlike many simple demos, CricScore implements full **Mutual TLS (mTLS)** for all Kafka communication. We securely inject client certificates as Base64 environment variables into our serverless functions.
- **Zero-Latency Broadcast:** By triggering AWS Lambdas directly from Aiven Kafka events, we bypass traditional polling and deliver live scores to thousands of fans instantly.

📖 **[Read Our Full Aiven Journey Story (#AivenFreeTier)](./docs/aiven_journey.md)**

---

---

## ⚡ Getting Started
- **Live Production:** [venkateshsingamsetty.site](https://venkateshsingamsetty.site)
- **Deployment Guide:** **🚀 [How to Clone and Deploy Your Own Instance](./docs/cloning_guide.md)**

---

## 🏗️ Technical Portal
Detailed engineering docs can be found in the **[`docs/`](./docs)** folder:

- **[Architectural Flows](./docs/architecture_diagrams.md)**: Mermaid diagrams for score updates, emails, and data hydration.
- **[System Overview](./docs/architecture.md)**: High-level Event-Driven Architecture (EDA) & Component breakdown.
- **[API Guide](./docs/api.md)**: REST & WebSocket contract specifications.
- **[Full Project Log](./docs/changelog.md)**: Complete project history and v1.2.0 release notes.
- **[Infrastructure Stack](./docs/infrastructure.md)**: Aiven & AWS service configurations.
- **[Cloning Guide](./docs/cloning_guide.md)**: How to deploy your own instance.
- **[Cost & Performance](./docs/cost_management.md)**: Free-tier monitoring and optimization strategy.

---

## 🌐 Web Traffic & Infrastructure Journey
This diagram illustrates the request flow from the moment a user hits **https://venkateshsingamsetty.site** until the **CricScore** application is running in their browser.

```mermaid
graph TD
    User((User Browser)) -->|1. Hit venkateshsingamsetty.site| R53[Route 53 DNS]
    R53 -->|2. Resolve Alias| CF[CloudFront CDN]
    CF -->|3. Fetch Assets| S3[S3 Static Website Bucket]
    
    subgraph Browser_Environment [CricScore Client]
        User
        React[React / Vite App]
        State[LocalState / Storage]
    end
    
    CF -.->|4. Load Bundle| User
    User --> React
    
    React -->|5. HTTP Actions| APIGW_REST[API Gateway - REST]
    React -->|6. Real-time| APIGW_WS[API Gateway - WebSocket]
    
    subgraph Backend_Cloud [AWS / Aiven Hybrid Stack]
        APIGW_REST --> Lambda_API[Match API Lambda]
        APIGW_WS --> Lambda_WS[Broadcaster Lambda]
        
        Lambda_API --> PG[(Aiven PostgreSQL)]
        Lambda_WS --> DDB[(DynamoDB Connections)]
        Lambda_API -.->|7. Report| SES[AWS SES]
    end
    
    Lambda_API -->|8. Score Event| Kafka{Aiven Kafka mTLS}
    Kafka -->|9. Fan Stream| Lambda_WS
```

---

## 🚀 Contribution & Development
CricScore welcomes community contributions. Please refer to the **[Cloning Guide](./docs/cloning_guide.md)** to set up your development environment.

---

---
© 2026 CricScore Engine. Designed for the Serverless Generation.
