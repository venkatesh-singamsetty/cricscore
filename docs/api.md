# 🛰️ API & WebSocket Documentation

CricScore provides a RESTful interface for scoring actions and a real-time WebSocket protocol for live updates.

---

## 🚦 HTTP API Endpoints
**Base URL**: `https://mmiwp8rgrf.execute-api.us-east-1.amazonaws.com`

### 🏟️ Match Management (REST)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/match` | `POST` | **Initialize Match**: Registers a new game in Aiven PostgreSQL. Returns a unique `matchId`. |
| `/match/{id}/innings` | `POST` | **Create Second Innings**: Registers the second innings. Returns a unique `inningId`. |
| `/match/{id}` | `DELETE` | **Permanent Cleanup**: Removes a match record and all associated innings/stats. |
| `/match/{id}/email` | `POST` | **Cloud Scorecard**: Generates and sends a high-fidelity HTML email via AWS SES. |
| `/match/{id}/details` | `GET` | **Full Match Details**: Retrieves full scorecard details including all innings, players, bowlers, and ball events for a specific match ID. |
| `/matches` | `GET` | **Match Discovery Hub**: Returns all active and historical matches, including `STALE`/`STALLED` status flags. |
- **Response**: Full match metadata from Aiven PostgreSQL.

### 3. **Update Score (The Engine)**
`POST /update-score` - Logs a ball delivery and streams it globally.
- **Body**: `{ matchId, inningId, ballData }`
- **Payload Structure**:
    ```json
    {
      "ballData": {
        "overNumber": 0, "ballNumber": 1,
        "bowlerName": "Bumrah", "batterName": "Willamson",
        "runs": 4, "isExtra": false,
        "commentary": "Superb drive!"
      }
    }
    ```
- **Response**: `{"success": true, "ballId": "ball_uuid"}`
- **Error Handling (v1.3.0)**: Returns `404 Not Found` if the `matchId` has been deleted by an Administrator. The Scorer UI performs a **Force Reset** upon detection.

---

## 🌐 WebSocket Gateway
**WebSocket URL**: `wss://i4cnmjy0tg.execute-api.us-east-1.amazonaws.com/prod`

### 1. **Subscribe**
Connection establishes a persistent session. The `onConnect` handler automatically stores your session ID in DynamoDB.

### 2. **Live Event Stream**
When a score is updated, all connected clients receive the following event:
```json
{
  "type": "LIVE_SCORE_UPDATE",
  "data": {
    "ballId": "becb2056-...",
    "runs": 6,
    "commentary": "HUGE! Over the ropes!"
    ... 
  }
}
```

---

---

## 🌐 Match Sharing & Deep-Linking (v1.5.2)

CricScore utilizes a **Deep-Link Restoration Protocol** to enable viral match-day growth. The primary gateway for spectator onboarding is the **Match Details API**.

### GET `/match/{id}/details`
**Endpoint**: `/match/{matchId}/details`  
**Method**: `GET`  
**Primary Usage**: The foundational bridge for **Sharable Links** (`?matchId=xxx`).

- **Description**: Reconstructs the entire match state from Aiven PostgreSQL.
- **Data Payload**: Returns a unified JSON object containing:
    - **Match Metadata**: Status, Team Names, Total Overs.
    - **Innings Objects**: Unified ball-by-ball history, player stats, and bowler metrics.
- **Viewer Flow**: When a fan hits a sharable link, the UI detects the `matchId`, triggers this GET request, and hydrates the **Live Scoreboard** instantly.

---

## 🛠️ Internal Administrative Actions

### POST `/match/:matchId/email`
**Restricted Usage**: Administrative Backend Logging.

- **Purpose**: Generates a high-fidelity HTML record and persists it to a verified administrator endpoint via AWS SES.
- **Sandbox Compliance**: This endpoint is decoupled from the spectator flow, ensuring that SES Sandbox verification restrictions do not impact the viral sharing of match links.

**Request Body:**
```json
{
  "emailTo": "official@example.com",
  "origin": "https://cricscore.site"
}
```

---

## 🛠️ Testing Tools
- **WebSocket Tester**: [PieSocket Client Tool](https://piehost.com/websocket-tester)
- **HTTP Client**: Use `curl`, `Postman`, or the Scorer UI (Phase 6).

