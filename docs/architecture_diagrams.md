# 🏗️ CricScore Detailed Sequence Flows

Below are the detailed sequence flow diagrams illustrating the end-to-end technical processes for live scoring, data hydration, and automated reporting.

For a high-level overview of the web traffic journey, see the [main README](../README.md#🌐-web-traffic--infrastructure-journey).

---

## 1. ⚡ Live Score Update (Dual-Write & Broadcast) Flow
This architecture details the `POST /update-score` flow initiated when a Scorer records a run. It uses an asynchronous fast-path to overcome external Kafka connector delays, streaming updates to fans globally with sub-second latency.

```mermaid
sequenceDiagram
    autonumber
    
    actor Scorer as Scorer (Tab 1)
    participant APIGW_HTTP as HTTP API Gateway
    participant Lambda_Score as Score Update Lambda
    participant Aiven_PG as Aiven PostgreSQL
    participant Aiven_Kafka as Aiven Kafka
    participant Lambda_Broadcast as Kafka Consumer Lambda
    participant DDB as DynamoDB (Connections)
    participant APIGW_WS as WebSocket Gateway
    actor Spectator as Spectators (Tab 2)

    Scorer->>APIGW_HTTP: POST /update-score (Runs, Wicket, Metadata)
    APIGW_HTTP->>Lambda_Score: Forward Request
    
    rect rgb(0, 0, 0, 0.1)
        Note right of Lambda_Score: Secure Dual-Write Engine
        Lambda_Score->>Aiven_PG: UPDATE innings & ball_events
        Lambda_Score->>Aiven_PG: UPDATE matches (Metadata Failover Sync)
        Aiven_PG-->>Lambda_Score: Returns `ballId`
        Lambda_Score->>Aiven_Kafka: Publish Message to 'score-updates' (mTLS encrypt)
    end
    
    Aiven_Kafka-->>Lambda_Score: ACK
    
    rect rgb(29, 78, 216, 0.2)
        Note right of Lambda_Score: Fast-Path Broadcast
        Lambda_Score-)Lambda_Broadcast: InvokeAsync(Mock Event payload)
        Lambda_Score-->>APIGW_HTTP: HTTP 200 OK (success)
        APIGW_HTTP-->>Scorer: UI confirms successful update
    end
    
    Lambda_Broadcast->>DDB: Scan active connections
    DDB-->>Lambda_Broadcast: Returns Connection IDs
    
    loop For Each Connection
        Lambda_Broadcast->>APIGW_WS: PostToConnection (LIVE_SCORE_UPDATE payload)
        APIGW_WS-->>Spectator: Real-time update rendered on screen
    end
```

---

## 2. 📊 Fetch Match Details (Historical/Initial Load) Flow
This architecture details the `GET /match/{matchId}/details` flow used when a completely new Spectator opens a match, or someone wants to view the final scorecard from the discovery hub.

```mermaid
sequenceDiagram
    autonumber
    
    actor Viewer as Fan / Spectator
    participant APIGW_HTTP as HTTP API Gateway
    participant Lambda_Match as Match API Lambda
    participant Aiven_PG as Aiven PostgreSQL
    
    Viewer->>APIGW_HTTP: GET /match/{matchId}/details
    
    %% Preflight Options (CORS) check automatically handled mapping by Gateway 
    APIGW_HTTP->>Lambda_Match: Forward Request
    
    rect rgb(0, 0, 0, 0.1)
        Note right of Lambda_Match: Data Hydration
        
        Lambda_Match->>Aiven_PG: SELECT FROM matches WHERE id = matchId
        Aiven_PG-->>Lambda_Match: Return Match Metadata (Status, Teams, TotalOvers)
        
        Lambda_Match->>Aiven_PG: SELECT FROM innings WHERE match_id = matchId
        Aiven_PG-->>Lambda_Match: Return Array of Innings (Inns 1, Inns 2)
        
        loop For Each Inning
            Lambda_Match->>Aiven_PG: SELECT FROM players (Batters)
            Aiven_PG-->>Lambda_Match: Return Batter Stats
            
            Lambda_Match->>Aiven_PG: SELECT FROM bowlers
            Aiven_PG-->>Lambda_Match: Return Bowler Stats
            
            Lambda_Match->>Aiven_PG: SELECT FROM ball_events
            Aiven_PG-->>Lambda_Match: Return Event Timeline
        end
    end
    
    Lambda_Match->>Lambda_Match: Aggregate into JSON scorecard object
    Lambda_Match-->>APIGW_HTTP: HTTP 200 OK w/ CORS Headers
    APIGW_HTTP-->>Viewer: Client renders Full Scorecard & starts listening to WS
```

---

## 3. ⚙️ Match Duration (Overs) Synchronization
This architecture details the specific flow for real-time match length adjustments (e.g. reducing a 20-over game to 15 overs due to time constraints).

```mermaid
sequenceDiagram
    autonumber
    
    actor Scorer as Scorer
    participant APIGW_HTTP as HTTP API Gateway
    participant Lambda_Match as Match API Lambda
    participant Lambda_Score as Score Update Lambda
    participant Aiven_PG as Aiven PostgreSQL
    participant Spectator as Spectators (Live Hub)

    Scorer->>Scorer: Click total overs (In-place edit)
    Scorer->>APIGW_HTTP: PATCH /match/{matchId} { totalOvers: 15 }
    APIGW_HTTP->>Lambda_Match: Handle PATCH metadata
    Lambda_Match->>Aiven_PG: UPDATE matches SET total_overs = 15
    Lambda_Match-->>Scorer: HTTP 200 OK (Persisted)

    rect rgb(0, 0, 0, 0.1)
        Note left of Scorer: On Next Ball or Manual Sync
        Scorer->>APIGW_HTTP: POST /update-score { matchTotalOvers: 15 }
        APIGW_HTTP->>Lambda_Score: Broadcast update
        Lambda_Score->>Spectator: WebSocket(STATE_SYNC: totalOvers=15)
        Note right of Spectator: UI updates instantly globally
    end
```

---

## 4. 🏁 Match Conclusion & Email Reporting (SES)
This architecture details the automated reporting flow triggered when a match concludes. It highlights the integration with **AWS Simple Email Service (SES)** to deliver high-fidelity HTML scorecards from **noreply@venkateshsingamsetty.site**.

```mermaid
sequenceDiagram
    autonumber
    
    actor Admin as Admin / Scorer
    participant APIGW as HTTP API Gateway
    participant Lambda as Match API Lambda
    participant Aiven_PG as Aiven PostgreSQL
    participant SES as AWS SES (Verified Domain)
    participant DNS as Route53 (venkateshsingamsetty.site)
    actor Recipient as Fan Email

    Admin->>Admin: Click "End Match" / "Email Scorecard"
    Admin->>APIGW: POST /match/{matchId}/email { emailTo: "fan@example.com" }
    APIGW->>Lambda: Trigger Reporting Engine
    
    rect rgb(0, 0, 0, 0.1)
        Note right of Lambda: Data Aggregation
        Lambda->>Aiven_PG: SELECT matches, innings, players, bowlers
        Aiven_PG-->>Lambda: Return Complete Results
        Lambda->>Lambda: Generate Responsive HTML Template
    end
    
    Lambda->>SES: SendEmailCommand(htmlBody, source: "noreply@venkateshsingamsetty.site")
    
    rect rgb(29, 78, 216, 0.2)
        Note right of SES: Identity Verification
        SES->>DNS: Verify DKIM/SPF Records
        DNS-->>SES: Logic Confirmed
    end
    
    SES->>Recipient: Deliver 🏏 FINAL SCORECARD (High Deliverability)
    SES-->>Lambda: MessageId
    Lambda-->>APIGW: HTTP 200 OK
    APIGW-->>Admin: UI: "Fancy email sent successfully"
```
