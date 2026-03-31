# 🛰️ API & WebSocket Documentation

CricScore provides a RESTful interface for scoring actions and a real-time WebSocket protocol for live updates.

---

## 🚦 RESTful Service Endpoints (Aiven PostgreSQL)
**Base URL**: `https://mmiwp8rgrf.execute-api.us-east-1.amazonaws.com`

| Endpoint | Method | Role | Auth Required |
| :--- | :--- | :--- | :--- |
| `/match` | `POST` | Initialize fresh match UUID | None |
| `/matches` | `GET` | Discovery Hub (Browse active games) | None |
| `/match/{id}` | `DELETE` | Permanent DB Cleanup | **Admin PIN** |
| `/match/{id}/details` | `GET` | **Deep-Link Recovery** (v2.0) | None |
| `/match/{id}/innings` | `POST` | Register 2nd Innings | None |
| `/update-score` | `POST` | SNS Fan-Out Producer | None |

---

## 🏛️ Key Implementation Details

### 1. **Deep-Link Restoration Gateway**
`GET /match/{matchId}/details`

This is the primary engine for **v1.5.2 Viral Sharing**. When a spectator arrives via a sharable link (`?matchId=xxx`), the client performs a high-fidelity hydration:
- **Response**: A complete JSON snapshot of the match state from Aiven PostgreSQL.
- **Includes**: Match metadata, innings objects, player/bowler stats, and full event history.
- **Goal**: Instant scoreboard recovery without account creation or email verification.

### 2. **Score Update (The Engine)**
`POST /update-score`

This endpoint triggers the **SNS Fan-Out Protocol** (v2.0). It instantly publishes the ball event to AWS SNS returning a `200 OK` in milliseconds. AWS SQS then responsibly persists it to Aiven PostgreSQL for history and Aiven Kafka for enterprise streaming.
- **Payload**: `{ matchId, inningId, ballData }`
- **Error States**: Returns `404` if the match has been deleted from the registry (triggering a client-side force reset).

### 3. **Administrative Match Cleanup**
`DELETE /match/{id}`

Restricted endpoint for match management. Purges the record and all child ball events via `CASCADE DELETE`.
- **Requirement**: Must include the correct `VITE_ADMIN_PIN` in the request header or body logic.

---

## 🌐 WebSocket Stream (Aiven Kafka)
**URL**: `wss://i4cnmjy0tg.execute-api.us-east-1.amazonaws.com/prod`

The WebSocket gateway handles the high-throughput broadcast from AWS SNS / Aiven Kafka to spectators globally.

- **Fast-Path Broadcast**: Messages are distributed directly via SNS triggers with **<100ms** internal latency.
- **Identity Registry**: Client connection IDs are managed via **AWS DynamoDB**.
- **Event Type**: `LIVE_SCORE_UPDATE` - Unified JSON payload containing real-time ball metrics.

---

## 🛠️ Testing Tools
- **WebSocket Tester**: [PieSocket Client Tool](https://piehost.com/websocket-tester)
- **REST Client**: `curl`, `Postman`, or the Scorer UI in debug mode.

© 2026 CricScore Documentation. 🛰️🏁🚀

