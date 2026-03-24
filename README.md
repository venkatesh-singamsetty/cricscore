# 🏏 CricScore: Real-Time Cricket Match Engine

[![Aiven](https://img.shields.io/badge/Aiven-Managed%20Services-blue)](https://aiven.io)
[![AWS](https://img.shields.io/badge/AWS-Serverless-orange)](https://aws.amazon.com)
[![Kafka](https://img.shields.io/badge/Kafka-Event%20Streaming-black)](https://kafka.apache.org)

CricScore is a highly performant, real-time cricket match engine designed for sub-second live score updates. It handles dual-write persistence into **PostgreSQL** and event-streaming through **Kafka** with **mTLS (Mutual TLS)** security.

---

## ⚡ Quick Start

### 1. **Infrastructure Prep**
```bash
cd terraform
terraform init && terraform apply -auto-approve
```

### 2. **Core Endpoints**
- **HTTP API**: `https://mmiwp8rgrf.execute-api.us-east-1.amazonaws.com`
- **WebSocket Gateway**: `wss://i4cnmjy0tg.execute-api.us-east-1.amazonaws.com/prod`

---

## 🏗️ Technical Portal
Detailed engineering docs can be found in the **[`docs/`](./docs)** folder:

- **[Architecture](./docs/architecture.md)**: Mermaid diagrams and EDA event flow.
- **[API Guide](./docs/api.md)**: HTTP & WebSocket contract details.
- **[Infrastructure](./docs/infrastructure.md)**: Aiven & AWS configuration.
- **[Roadmap](./docs/roadmap.md)**: Feature status and future phases.
- **[Troubleshooting](./docs/troubleshooting.md)**: Fixed issues (mTLS, Timeouts).

---

## ⚡ Key Highlights
- **Dual-Write Architecture**: ACID-compliant records in PostgreSQL + high-throughput streaming in Kafka.
- **mTLS Encryption**: Secure broker communication via Mutual TLS (Client Certificates).
- **Fast-Path Broadcast**: Asynchronous broadasting from Kafka to WebSockets for sub-second latency.
- **100% Serverless**: Optimized for minimal cost and maximum scale.

---

## 🏗️ Cloning & Custom Deployment

To deploy your own instance of CricScore using your own **Aiven** and **AWS** accounts:

### 1. **Infrastructure Variables**
Create `terraform/terraform.tfvars` with your Aiven credentials:
```hcl
database_url          = "postgres://avns_admin:..."
kafka_bootstrap_servers = ["p-1.aivencloud.com:17729"]
kafka_username        = "..."
kafka_password        = "..."
```

### 2. **Frontend Config**
Copy `.env.example` to `.env` and provide your AWS API Gateway URLs:
```bash
cp .env.example .env
# Edit .env with your generated terraform outputs
```

### 3. **mTLS Certificates (Variable-Driven)**
Encode your Aiven Kafka certificates to Base64 and add them to `terraform.tfvars`:
```bash
# How to encode your certs:
openssl base64 -A -in ca.pem
openssl base64 -A -in cert.pem
openssl base64 -A -in key.pem
```

```hcl
# Example in terraform.tfvars
kafka_ca_cert     = "LS0tLS1CRUdJTiBDRV..."
kafka_access_cert = "LS0tLS1CRUdJTiBDRV..."
kafka_access_key  = "LS0tLS1CRUdJTiBQUk..."
```

---
- **2026-03-22**: Completed Phase 3, 4, and 5 (Real-time Broadcast).
- **2026-03-22**: **Phase 6 Complete**: Integrated Discovery Hub & Multi-Match Fan Dashboard. ✨
- **2026-03-22**: Sub-second latency verified across Aiven Kafka + AWS WebSockets. 🚀
- **2026-03-22**: **Live Update Patch**: Fixed match provisioning, data hydration, and dynamic route routing for Spectator/History Views. 🏏
- **2026-03-23**: **Persistence & Analytics Fix**: Implemented DB-side aggregate tracking for players, bowlers, and innings. Fixed "Empty Analytics" bug by synchronizing squad initialization and real-time stat accumulation in PostgreSQL. 📊
- **2026-03-23**: **Fans Live Visibility & Navigation Patch**: Removed "white screen" bugs in Spectator view. Implemented forced tab-refreshing via React keys and enabled immediate snapshot data (Batters/Bowlers) for fans joining live matches. 📡
- **2026-03-23**: **Live Score Accuracy Patch**: Fixed "off-by-one" over display at end of over. Implemented proactive crease synchronization for spectators and filtered summaries to show only active players. 🏏
- **[2026-03-24] Resilience & Premium Reporting Engine (Latest)**: 
    - **Role-Based Access Control (RBAC)**: Implemented 3-tab UI (**VIEWER**, **SCORER**, **ADMIN**). 🛡️
        - **VIEWER**: Pure spectator experience (Read-only).
        - **SCORER**: Streamlined "one-match" flow with automatic resume of current match and no deletion rights.
        - **ADMIN**: Full control (Manual Resume, Single Delete, and Global DB Purge).
    - **[2026-03-24] UX & Spectator Experience Finalization (Latest)**: 
        - **Celebratory UI**: Overhauled the match conclusion experience with a premium, high-impact "Match Over" banner featuring shimmering gradients, trophies, and final result summary. 🏆
        - **Unified Hub Search**: Transformed the "Follow Match ID" field into a powerful **Search & Filter** engine. Spectators can now find matches by **Team Name** or ID instantly. 🔍
        - **Intelligent Navigation**: 
            - **Auto-Open Scorecard**: Selecting a finished match from the Hub now immediately launches the full Scorecard modal, bypassing intermediate views.
            - **Auto-Return**: Closing a historical scorecard now automatically takes the viewer back to the Match Hub list, streamlining review workflows. 🔄
        - **Real-Time Hub Updates**: Implemented a cross-session broadcast system (`HUB_UPDATE`). Match Hub lists now update automatically across all devices when a new game is started or an old one is deleted, with no manual refresh required. 📡
        - **Email Throttling**: Integrated `localStorage` state-based persistence to prevent duplicate scorecard emails on page reloads after match conclusion. ✉️
        - **Infrastructure Upgrades**: Configured cross-Lambda invocation permissions for synchronous WebSocket-to-HTTP signaling. 🔗
    - **High-Reliability Email Reporting (SES)**: 
        - Automated scorecard delivery on match completion (+ manual resend option for Admins). 🚀
        - **Enterprise DNS**: Verified domain identity (`venkateshsingamsetty.site`) with DKIM/SPF records for high deliverability.
    - **Database Governance**: 
        - Full `ON DELETE CASCADE` implementation for clean record purging.
        - **Global Purge**: Admin button to wipe all matches/innings/balls to clear storage. 🗑️
    - **Deep State Persistence**: 
        - Tabs & live scoring state survive browser refreshes and mobile closure.
        - Synchronized ball-by-ball updates from MatchView to App root for multi-tab resilience. 🛡️
    - **Match Lifecycle**: 
        - **STALED Label**: Live matches >24h old are flagged but remain resumable for completion.
        - **COMPLETED**: Historical records are locked from further editing/resuming.
