# 🛰️ API & WebSocket Reference

CricScore exposes a regional **Amazon API Gateway HTTP API** (`https://api.<domain>`) for REST operations and an **Amazon API Gateway WebSocket API** (`wss://ws.<domain>`) for real-time spectator score broadcasts.

---

## 🔄 1. Request & Real-Time Event Flow

```mermaid
flowchart LR
    subgraph Clients ["Client Tier"]
        Scorer["Scorer / Admin SPA"]
        Viewer["Spectator SPA"]
    end

    subgraph Edge ["API Gateway (us-east-1)"]
        HTTP["HTTP API (api.<domain>)"]
        JWT{"Cognito JWT Authorizer"}
        WS["WebSocket API (ws.<domain>)"]
    end

    subgraph Compute ["AWS Lambda Functions"]
        MatchAPI["match-api (Node 24)"]
        ScoreUpd["score-upd (Node 24)"]
        ChatAPI["chat-api (Node 24)"]
        MLPredict["ml-predict (Python 3.12 ECR)"]
        Broadcaster["broadcaster (Node 24)"]
        StorageWorker["storage-worker (Node 24)"]
        WSHandlers["onconnect / ondisconnect"]
    end

    subgraph MessagingAndData ["Messaging & Persistence"]
        SNS{{"SNS Topic (match-events)"}}
        SQS[["SQS FIFO (storage-buffer.fifo)"]]
        DDB[("DynamoDB (connections)")]
        PG[("Aiven PostgreSQL + pgvector")]
        S3[("Amazon S3 (Backups & Models)")]
    end

    Scorer -->|"REST + Bearer JWT"| HTTP
    Viewer -->|"Public GET / POST"| HTTP
    HTTP --> JWT
    JWT --> MatchAPI & ScoreUpd & ChatAPI
    HTTP -->|"Public Routes"| MatchAPI & ChatAPI & MLPredict

    ScoreUpd -->|"Parallel Fan-Out"| SNS & SQS
    SNS --> Broadcaster
    SQS --> StorageWorker
    MatchAPI -.->|"Async HUB_UPDATE"| Broadcaster

    Viewer <-->|"wss:// ($connect / frames)"| WS
    WS --> WSHandlers --> DDB
    Broadcaster -->|"PostToConnection"| WS
    MatchAPI & StorageWorker & ChatAPI --> PG
    MatchAPI & MLPredict --> S3
```

---

## 🚦 2. HTTP API Routes (`infra/terraform/apigateway_http.tf`)

**Base URL**:

- **Dev**: `https://api.cricscoredev.venkateshsingamsetty.com`
- **Prod**: `https://api.cricscore.venkateshsingamsetty.com`
- **Throttling**: Default stage limit `50 req/s` (`100` burst); `POST /chat` and `POST /chat/summary` capped at `5 req/s` (`10` burst).

### Match & Scoring Endpoints

| Method   | Route                      | Auth (API GW + Lambda)         | Lambda Handler | Description                                                                                                                         |
| :------- | :------------------------- | :----------------------------- | :------------- | :---------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/health`                  | `NONE`                         | `match-api`    | Executes `SELECT 1 AS ok` on PostgreSQL; returns `200` (`healthy`) or `503` (`unhealthy`)                                           |
| `GET`    | `/matches`                 | `NONE`                         | `match-api`    | Lists all matches with innings scores, toss details, and `is_test` flags                                                            |
| `POST`   | `/match`                   | `JWT` (Scorer / Guest / Admin) | `match-api`    | Creates match + Innings 1, bulk-inserts batting/bowling squads, broadcasts `HUB_UPDATE`                                             |
| `GET`    | `/match/{matchId}`         | `NONE`                         | `match-api`    | Fetches match header row by UUID                                                                                                    |
| `GET`    | `/match/{matchId}/details` | `NONE`                         | `match-api`    | Deep-link restoration: returns match header, ordered innings, players (`ORDER BY batting_position ASC`), bowlers, and `ball_events` |
| `PATCH`  | `/match/{matchId}`         | `JWT` + Owner/Admin            | `match-api`    | Updates overs, status (`COMPLETED`/`ABANDONED`), toss, or squads; triggers S3 JSON backup on completion                             |
| `DELETE` | `/match/{matchId}`         | `JWT` + Owner/Admin            | `match-api`    | Deletes match (`ON DELETE CASCADE` removes innings/players/bowlers/balls) and broadcasts `HUB_UPDATE`                               |
| `POST`   | `/match/{matchId}/innings` | `JWT` + Owner/Admin            | `match-api`    | Initializes or upserts 2nd innings and squads, sets target score, and broadcasts `HUB_UPDATE`                                       |
| `POST`   | `/match/{matchId}/email`   | `JWT` + Owner/Admin            | `match-api`    | Formats HTML scorecard report and dispatches via Amazon SES                                                                         |
| `POST`   | `/update-score`            | `JWT` + Owner/Admin            | `score-upd`    | Publishes live ball/sync event in parallel to SNS (`match-events`) and SQS FIFO (`storage-buffer.fifo`)                             |

### AI, RAG Rulebooks & ML Inference Endpoints

| Method   | Route            | Auth (API GW + Lambda) | Lambda Handler | Description                                                                                                      |
| :------- | :--------------- | :--------------------- | :------------- | :--------------------------------------------------------------------------------------------------------------- |
| `POST`   | `/match/predict` | `NONE`                 | `ml-predict`   | Hybrid win-probability inference (XGBoost `v2.2.0` + Markov DP + DLS par calculator)                             |
| `POST`   | `/chat`          | `NONE` (`5 rps` cap)   | `chat-api`     | Read-only Agentic AI Chat (MCP tools: `execute_sql`, `search_rules`, `get_match_weather`, `create_github_issue`) |
| `POST`   | `/chat/summary`  | `NONE` (`5 rps` cap)   | `chat-api`     | Generates or returns cached plain-English AI match summary                                                       |
| `GET`    | `/rules`         | `JWT` + `requireAdmin` | `chat-api`     | Lists ingested tournament PDF rulebooks and chunk counts from `pgvector`                                         |
| `POST`   | `/rules/upload`  | `JWT` + `requireAdmin` | `chat-api`     | Parses uploaded PDF, chunks text, embeds via `text-embedding-3-small`, and stores vectors                        |
| `DELETE` | `/rules`         | `JWT` + `requireAdmin` | `chat-api`     | Deletes a tournament rulebook and its embeddings from PostgreSQL                                                 |

### Admin & Database Maintenance Endpoints

| Method   | Route                       | Auth (API GW + Lambda)  | Lambda Handler | Description                                                                              |
| :------- | :-------------------------- | :---------------------- | :------------- | :--------------------------------------------------------------------------------------- |
| `DELETE` | `/matches`                  | `JWT` + `isAdminClaims` | `match-api`    | Full database purge (`TRUNCATE ... RESTART IDENTITY CASCADE`) and `HUB_UPDATE` broadcast |
| `GET`    | `/admin/users`              | `JWT` + `isAdminClaims` | `match-api`    | Lists Cognito User Pool users with `isAdmin` and `isScorer` group flags                  |
| `DELETE` | `/admin/users`              | `JWT` + `isAdminClaims` | `match-api`    | Permanently deletes a Cognito user (blocks self-deletion and root admin deletion)        |
| `POST`   | `/admin/users/roles`        | `JWT` + `isAdminClaims` | `match-api`    | Promotes a user to `Admin` or `Scorer` Cognito group                                     |
| `DELETE` | `/admin/users/roles`        | `JWT` + `isAdminClaims` | `match-api`    | Removes a user from `Admin` or `Scorer` Cognito group                                    |
| `DELETE` | `/admin/users/guests`       | `JWT` + `isAdminClaims` | `match-api`    | Bulk-deletes `guest-*` shadow users from Cognito User Pool                               |
| `DELETE` | `/admin/matches/guests`     | `JWT` + `isAdminClaims` | `match-api`    | Deletes all matches scored by `guest-*` accounts                                         |
| `DELETE` | `/admin/matches/incomplete` | `JWT` + `isAdminClaims` | `match-api`    | Deletes matches where `status NOT IN ('COMPLETED', 'ABANDONED')`                         |
| `DELETE` | `/admin/matches/test`       | `JWT` + `isAdminClaims` | `match-api`    | Deletes automated/practice matches (`is_test = TRUE` or test team/email patterns)        |

---

## 🌐 3. WebSocket API & Broadcast Protocol (`infra/terraform/apigateway_websocket.tf`)

**Endpoint**: `wss://ws.cricscoredev.venkateshsingamsetty.com` (Dev) | `wss://ws.cricscore.venkateshsingamsetty.com` (Prod)

| Direction / Route                        | Handler / Source                                          | DynamoDB / API Action                                                              | Payload / Frame Format                                                                               |
| :--------------------------------------- | :-------------------------------------------------------- | :--------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| `CLIENT -> $connect`                     | `onconnect`                                               | `PutItem` (`connectionId`) in `<project>-connections`                              | Handshake upgrade (`HTTP 101 Switching Protocols`)                                                   |
| `CLIENT -> $disconnect`                  | `ondisconnect`                                            | `DeleteItem` (`connectionId`) in `<project>-connections`                           | Automatic cleanup on tab close or disconnect                                                         |
| `SERVER -> CLIENT` (`LIVE_SCORE_UPDATE`) | `score-upd` $\rightarrow$ SNS $\rightarrow$ `broadcaster` | Scans `connections`, sends `PostToConnectionCommand` (prunes stale `410` sockets)  | `{ "matchId": "<uuid>", "inningId": "<uuid>", "type": "LIVE_SCORE_UPDATE", "ballData": { ... } }`    |
| `SERVER -> CLIENT` (`STATE_SYNC`)        | `score-upd` $\rightarrow$ SNS $\rightarrow$ `broadcaster` | Pushes bowler/batter selection or `undo: true` state rollback                      | `{ "matchId": "<uuid>", "type": "STATE_SYNC", "syncOnly": true, "ballData": { "undo": true, ... } }` |
| `SERVER -> CLIENT` (`HUB_UPDATE`)        | `match-api` $\rightarrow$ `broadcaster`                   | Direct async Lambda invocation when match is created, deleted, or switches innings | `{ "matchId": "<uuid>", "type": "HUB_UPDATE", "syncOnly": true, "timestamp": "..." }`                |

---

## 🧪 4. Runnable CLI Test Commands

Set your target API base URL before running the commands below:

```bash
export API_URL="https://api.cricscoredev.venkateshsingamsetty.com"
export WS_URL="wss://ws.cricscoredev.venkateshsingamsetty.com"
```

### Public Endpoint Checks (`curl`)

```bash
# 1. Database & API Health Check
curl -s "${API_URL}/health" | jq .

# 2. List Matches
curl -s "${API_URL}/matches" | jq '.[0:2]'

# 3. Fetch Full Match Details (replace <MATCH_ID>)
curl -s "${API_URL}/match/<MATCH_ID>/details" | jq '.match'

# 4. Run Hybrid ML Win-Probability Prediction
curl -s -X POST "${API_URL}/match/predict" \
  -H "Content-Type: application/json" \
  -d '{
    "inningNumber": 2,
    "totalRuns": 85,
    "totalWickets": 3,
    "overs": 10,
    "balls": 0,
    "totalOvers": 20,
    "target": 165
  }' | jq .

# 5. Query Read-Only AI Chat
curl -s -X POST "${API_URL}/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "What are the recent completed matches?"}' | jq .
```

### Authenticated Endpoint Checks (`curl` with Cognito JWT)

```bash
# Export a valid Cognito ID token from your browser session or Amplify CLI
export JWT_TOKEN="<YOUR_COGNITO_ID_TOKEN>"

# 1. Create a New Match (marked as test fixture)
curl -s -X POST "${API_URL}/match" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "teamA": "TEST ALPHA",
    "teamB": "TEST BRAVO",
    "totalOvers": 2,
    "batFirstTeam": "TEST ALPHA",
    "tossWinner": "TEST ALPHA",
    "tossDecision": "BAT",
    "teamASquad": ["Batter 1", "Batter 2"],
    "teamBSquad": ["Bowler 1", "Bowler 2"],
    "isTest": true
  }' | jq .

# 2. Publish a Ball Score Event
curl -s -X POST "${API_URL}/update-score" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "matchId": "<MATCH_ID>",
    "inningId": "<INNING_ID>",
    "ballData": {
      "overNumber": 0,
      "ballNumber": 1,
      "batsmanName": "Batter 1",
      "nonStrikerName": "Batter 2",
      "bowlerName": "Bowler 1",
      "runs": 4,
      "isWicket": false,
      "totalRuns": 4,
      "totalWickets": 0,
      "totalOvers": 0,
      "totalBalls": 1
    }
  }' | jq .

# 3. Clean Up Test Matches (Admin JWT Required)
curl -s -X DELETE "${API_URL}/admin/matches/test" \
  -H "Authorization: Bearer ${JWT_TOKEN}" | jq .
```

### Live WebSocket Stream Test (`npx wscat`)

```bash
# Connect as a spectator to inspect real-time LIVE_SCORE_UPDATE and HUB_UPDATE frames
npx -y wscat -c "${WS_URL}"
```
