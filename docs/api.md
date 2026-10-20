# 🛰️ API & WebSocket Documentation

CricScore provides a RESTful interface for scoring actions and a real-time WebSocket protocol for live updates.

---

## 🚦 RESTful Service Endpoints (Aiven PostgreSQL)

**Base URL**: `https://api.<domain>` (The custom domain is configured by Terraform and injected as `VITE_API_URL` by `infra/scripts/deploy.sh`)

| Endpoint                    | Method          | Role / behavior                            | Auth Required                              |
| :-------------------------- | :-------------- | :----------------------------------------- | :----------------------------------------- |
| `/health`                   | `GET`           | Health check                               | None                                       |
| `/match`                    | `POST`          | Create a match                             | Cognito JWT                                |
| `/match/{matchId}`          | `GET`           | Fetch match metadata                       | None                                       |
| `/match/{matchId}`          | `PATCH`         | Update match metadata                      | Cognito JWT; owner/admin checked by Lambda |
| `/match/{matchId}`          | `DELETE`        | Delete a match                             | Cognito JWT; owner/admin checked by Lambda |
| `/match/{matchId}/details`  | `GET`           | Fetch persisted match details for recovery | None                                       |
| `/match/{matchId}/innings`  | `POST`          | Add an innings                             | Cognito JWT; owner/admin checked by Lambda |
| `/match/{matchId}/email`    | `POST`          | Send a match report                        | Cognito JWT; owner/admin checked by Lambda |
| `/matches`                  | `GET`           | Browse matches                             | None                                       |
| `/matches`                  | `DELETE`        | Delete all matches                         | Cognito JWT; admin checked by Lambda       |
| `/update-score`             | `POST`          | Publish a score event to SNS and SQS       | Cognito JWT; owner/admin checked by Lambda |
| `/match/predict`            | `POST`          | Request a win prediction                   | None                                       |
| `/chat`                     | `POST`          | AI chat                                    | None                                       |
| `/chat/summary`             | `POST`          | Generate or retrieve a match summary       | None                                       |
| `/rules`                    | `GET`           | List rule documents                        | Cognito JWT + Admin group (server-checked) |
| `/rules`                    | `DELETE`        | Delete a rule document                     | Cognito JWT + Admin group (server-checked) |
| `/rules/upload`             | `POST`          | Upload and embed a PDF rule document       | Cognito JWT + Admin group (server-checked) |
| `/admin/users`              | `GET`           | List Cognito users                         | Cognito JWT; admin checked by Lambda       |
| `/admin/users`              | `DELETE`        | Delete a Cognito user                      | Cognito JWT; admin checked by Lambda       |
| `/admin/users/roles`        | `POST`/`DELETE` | Add or remove a user role                  | Cognito JWT; admin checked by Lambda       |
| `/admin/users/guests`       | `DELETE`        | Delete guest users                         | Cognito JWT; admin checked by Lambda       |
| `/admin/matches/guests`     | `DELETE`        | Delete guest matches                       | Cognito JWT; admin checked by Lambda       |
| `/admin/matches/incomplete` | `DELETE`        | Delete incomplete matches                  | Cognito JWT; admin checked by Lambda       |

> **Authorization note:** Routes marked `None` do not require a JWT at API Gateway. `/chat` is open so guests can chat, but it is strictly read-only: the request-body `isAdmin` value is ignored and no destructive tools are registered (see `docs/security_fixes.md`). `/chat/summary` can still invoke the LLM without a JWT. Rulebook management routes require a Cognito JWT **and** the `Admin` group (or `ADMIN_REPORT_EMAIL`), re-checked server-side in `chat-api`.

---

## 🏛️ Key Implementation Details

### 1. **Deep-Link Restoration Gateway**

`GET /match/{matchId}/details`

This supports shared-match recovery. When a spectator arrives via a sharable link (`?matchId=xxx`), the client loads persisted match state:

- **Response**: Match state read from Aiven PostgreSQL.
- **Includes**: Match metadata and persisted innings, player/bowler statistics, and ball events where available.
- **Goal**: Restore the scoreboard without requiring account creation or email verification.

### 2. **Score Update (The Engine)**

`POST /update-score`

This endpoint requires a Cognito JWT. The score-update Lambda checks match ownership or configured admin access, then sends the event to AWS SNS and directly to FIFO AWS SQS in parallel. It returns `200 OK` only after both sends succeed; delivery and response time depend on AWS and network conditions.

- **Payload**: `{ matchId, inningId, ballData }`
- **Error States**: Returns `403` when the caller is not authorized for the match; failures to send to SNS or SQS produce an error response.

### 3. **Administrative Match Cleanup**

`DELETE /match/{id}`

Restricted endpoint for match management. Purges the record and all child ball events via `CASCADE DELETE`.

- **Requirement**: Must include a valid **AWS Cognito JWT** in the Authorization header belonging to the match owner or an Admin.

---

## 🌐 WebSocket Stream (Spectator Feed)

**URL**: `wss://ws.<domain>` (Dynamically injected as `VITE_WS_URL` by `infra/scripts/deploy.sh`)

The WebSocket gateway handles the high-throughput broadcast from AWS SNS to spectators globally.

- **Broadcast**: SNS triggers the broadcaster Lambda, which sends updates to connected clients; no fixed delivery-latency guarantee is made.
- **Identity Registry**: Client connection IDs are managed via **AWS DynamoDB**.
- **Event Types**: `LIVE_SCORE_UPDATE` for scoring events and `STATE_SYNC` for state-sync/undo events.

---

## 🛠️ Testing Tools

- **WebSocket Tester**: [PieSocket Client Tool](https://piehost.com/websocket-tester)
- **REST Client**: `curl`, `Postman`, or the Scorer UI in debug mode.

© 2026 CricScore Documentation. 🛰️🏁🚀
