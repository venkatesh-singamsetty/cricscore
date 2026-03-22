# 🛰️ API & WebSocket Documentation

CricScore provides a RESTful interface for scoring actions and a real-time WebSocket protocol for live updates.

---

## 🚦 HTTP API Endpoints
**Base URL**: `https://mmiwp8rgrf.execute-api.us-east-1.amazonaws.com`

### 🏟️ Match Management (REST)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/match` | `POST` | **Initialize Match**: Registers a new game in Aiven PostgreSQL. Returns a unique `matchId`. |
| `/matches` | `GET` | **Live Discovery Hub**: Returns all active matches from the database, ordered by creation time. |
| `/match/{id}` | `GET` | **Match Details**: Retrieves full metadata for a specific match ID. |
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

## 🛠️ Testing Tools
- **WebSocket Tester**: [PieSocket Client Tool](https://piehost.com/websocket-tester)
- **HTTP Client**: Use `curl`, `Postman`, or the Scorer UI (Phase 6).
