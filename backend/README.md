# 🏗️ Backend: AWS Lambdas

This folder contains the core Node.js serverless functions that power the CricScore real-time match engine. 

---

## 🛠️ Compute Handlers

### 1. **Match API (`match-api/`)**
Handles RESTful initialization and lookup of matches within **Aiven PostgreSQL**.
- `POST /match`
- `POST /match/{matchId}/innings`
- `GET /matches`
- `GET /match/{matchId}`
- `GET /match/{matchId}/details`

### 2. **Score Update Producer (`score-update/`)**
The "Dual-Write" engine.
- Logs ball delivery to PostgreSQL.
- Streams event to **Aiven Kafka** via **mTLS**.
- Triggers the **Broadcaster** asynchronously for low-latency updates.

### 3. **Broadcaster (`kafka-consumer/`)**
The real-time broker logic.
- Polls/Receives Kafka events.
- Retrieves active sessions from **DynamoDB**.
- Pushes events to all connected **WebSockets**.

### 4. **Session Handlers (`onconnect/`, `ondisconnect/`)**
Manages the lifecycle of live spectators by updating the **DynamoDB** connection table.

---

## 🌩️ Deployment Notes
- **Runtime**: Node.js 18.x
- **SDK**: AWS SDK v3
- **Drivers**: `pg` (Postgres), `kafkajs` (Kafka)
- **Archiving**: Terraform automatically bundles these folders into ZIP files during `apply`.

---

## 🛡️ Security
- **Certificates**: `ca.pem`, `cert.pem`, and `key.pem` are embedded in the `score-update` and `kafka-consumer` bundles for secure mTLS broker communication.
