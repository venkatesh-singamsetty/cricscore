# 🏗️ Backend: AWS Lambdas

This folder contains the core Node.js serverless functions that power the CricScore real-time match engine. 

---

## 🛠️ Compute Handlers

### 1. **Match API (`match-api/`)**
Handles RESTful initialization, metadata updates, match reports, and lookup of matches within **Aiven PostgreSQL**.
- `POST /match`
- `POST /match/{matchId}/innings`
- `GET /matches`
- `GET /match/{matchId}`
- `GET /match/{matchId}/details`
- `POST /match/{matchId}/email`
- `DELETE /match/{matchId}`

### 2. **Score Update (`score-update/`)**
- Receives scoring events from the scorer client.
- Publishes events to the **AWS SNS Topic** for decoupled fan-out processing.

### 3. **Broadcaster (`broadcaster/`)**
- Receives events forwarded by the AWS SNS Topic (Fast-Path).
- Retrieves active connection registries from **DynamoDB**.
- Pushes events to all connected spectators via **API Gateway WebSockets**.

### 4. **Storage Worker (`storage-worker/`)**
- Consumes from the SQS queue (Reliability Buffer) asynchronously.
- Updates match metadata and ball-by-ball events in **Aiven PostgreSQL**.

### 5. **Session Handlers (`onconnect/`, `ondisconnect/`)**
Manages the lifecycle of live spectators by updating the **DynamoDB** connection registry.

---

## 🌩️ Deployment Notes
- **Runtime**: Node.js 18.x
- **SDK**: AWS SDK v3
- **Drivers**: `pg` (Postgres)
- **Archiving**: Terraform automatically bundles these folders into ZIP files during `apply`.

---

## 🛡️ Security
- **Data Protection**: All API endpoints and WebSocket feeds run over secure SSL/TLS (HTTPS & WSS).

