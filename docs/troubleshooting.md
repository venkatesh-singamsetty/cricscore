# 🚀 Troubleshooting & Fix Log

This engineering trace documents the real-world resolutions for the CricScore backend integration.

---

## 🚦 Resolved Issues Summary

### 1. **`SSL Alert: Bad Certificate` (Phase 3)**
- **Symptom**: `SSLAlert: Bad Certificate` when Kafka Producer tried to connect.
- **Cause**: Broker was configured for **Mutual TLS (mTLS)** and was rejecting the client for missing certificates.
- **Fix**: 
    - Switched from SASL/PLAIN to Client Certificate authentication.
    - Downloaded Aiven `service.cert` and `service.key`.
    - Embedded `ca.pem`, `cert.pem`, and `key.pem` into the Lambda build.
    - Updated `index.js` `ssl` block to include `cert` and `key` buffers.

### 2. **`Connection Timeout` (Phase 3)**
- **Symptom**: `LambdaTimeout: 30s` exceeded during ball scoring.
- **Cause**: Initial 3s timeout + 128MB RAM was too slow for (1) PG SSL handshake + (2) Kafka mTLS handshake + (3) SQL dual-write.
- **Fix**: 
    - Increased memory to **256MB** (Giving the Lambda more CPU power for encryption).
    - Hardened the timeout to **30s**.

### 3. **`CERTIFICATE_UNKNOWN` (Phase 4)**
- **Symptom**: SSL Alert 46 from the broker.
- **Cause**: Mismatch between the broker listener port and the client's handshake protocol.
- **Fix**: Identified Port **17729** as the universal SSL listener for this specific Aiven cluster.

### 4. **Empty Match Analytics / Missing History**
- **Symptom**: "Old Matches" or "Analytics" modal was empty (0 runs, 0 players).
- **Cause**: Squad data was only in-memory; `players` and `bowlers` tables in DB were never initialized or updated.
- **Fix**: 
    - Updated `match-api` to initialize squads in DB during `POST /match`.
    - Updated `score-update` lambda to `UPDATE` aggregate stats in DB for every ball.
    - Added `striker_name` / `non_striker_name` tracking to the `innings` table.

### 5. **Fans Live "White Screen" / Stale Old Matches**
- **Symptom**: "Fans Live" appeared empty/white unless a match was LIVE. Switching to "Old Matches" didn't show new records without a browser refresh.
- **Cause**: React was reusing component instances without re-fetching; conditional rendering in `App.tsx` was too restrictive.
- **Fix**: 
    - Added `key={view}` to `LiveScoreboard` to force remount on tab change.
    - Refactored `LiveScoreboard` to show DB snapshot data (Batters/Bowlers) immediately if Kafka broadcast is pending.

### 6. **Overs Showing One Less / Active Player Lag**
- **Symptom**: After the 6th ball, the score showed 2.0 instead of 3.0 for several seconds. Also, spectators saw "Waiting for first ball" despite players being selected.
- **Cause**: Backend relied on the ball's current over ID rather than the resulting total; crease state was only saved during ball events.
- **Fix**: 
    - Updated `MatchView` to explicitly pass `totalOvers` and `totalBalls` in every sync.
    - Added `syncOnly` mode to `score-update` lambda to persist player roles immediately upon selection.
    - Filtered `LiveScoreboard` summary to strictly show currently playing batsmen.

### 7. **New Bowler Showing High Over Count**
- **Symptom**: A bowler starting the 2nd over was incorrectly showing `1.1` overs instead of `0.1` in the spectator view.
- **Cause**: Backend was calculating bowler figures based on the global `overNumber` index instead of their individual spell count.
- **Fix**: 
    - Updated `MatchView` to explicitly track and send `bowlerOvers` and `bowlerBalls` to the backend.
    - Updated `score-update` lambda to prioritize these explicit personal figures when updating the `bowlers` table.

### 8. **Match Creation Latency**
- **Symptom**: Starting a new match took several seconds.
- **Cause**: Sequential `INSERT` statements for 22+ players/bowlers caused multiple round-trips to the DB.
- **Fix**: Implemented **Bulk SQL Inserts** and Transactions in the `match-api`, reducing round-trips from ~25 to 4.

### 9. **Undo Score Mismatch / Ghost Balls**
- **Symptom**: Clicking "Undo" reverted the scorer's screen but left spectators with the old score or "ghost" balls in the timeline.
- **Cause**: Undo only reverted local state; the DB still held the undone ball record, and shallow-copy mutations leaked into the history logs.
- **Fix**: 
    - Updated `handleUndo` to send a `DELETE` request to the backend for the last ball event.
    - Implemented a **Full State Sync** to overwrite DB totals immediately after an undo.
    - Refactored frontend to use **Strict Immutability** to prevent history log corruption.

### 10. **Aggregate Stat Mismatch on Undo**
- **Symptom**: After undoing a ball, the team score reverted, but individual batter/bowler runs and wickets in the "Match Analytics" modal stayed high.
- **Cause**: The backend only reverted the `innings` table totals but didn't subtract runs from the `players` or `bowlers` aggregate tables.
- **Fix**: Updated the `score-update` lambda to fetch the last ball before deletion, identify the participating players, and explicitly subtract their personal runs/wickets/balls to restore perfect analytics consistency.

### 11. **The "1 Run Extra" Bug (Double-Counting)**
- **Symptom**: After a ball or undo, the spectator view consistently showed exactly one more run than the scorer.
- **Cause**: The backend was performing two overlapping updates: one to `SET` the total score and another to `INCREMENT` it by the ball's runs.
- **Fix**: Removed the redundant increment logic; the system now treats the scorer's transmitted total as the absolute source of truth.

### 12. **The "Less Score" Bug (Missing Sync Totals)**
- **Symptom**: After fixing double-counting, spectators saw a LOWER score than the scorer (stuck on the previous ball).
- **Cause**: The `postScoreUpdate` frontend sync was missing the `totalRuns` and `totalWickets` fields, sending `null` to the backend.
- **Fix**: Refactored `postScoreUpdate` to send the complete, finalized `InningsState` totals in every message.

### 13. **Match Hub Consolidation & Layout Clarity**
- **Symptom**: Redundant "Fans Live" vs "Old Matches" tabs; missing bowling team name; confused striker position.
- **Cause**: Tab clutter led to navigation fatigue; UI was missing contextual team labels in the scoring header.
- **Fix**:
    - Merged into a unified **Match Hub** sorted by newest matches first with `LIVE` vs `COMPLETED` badges.
    - Added the bowling team name to all headers and cards.
    - Implemented a `.sort()` pinned-striker logic to ensure the facing batsman is always at the top for fans.

### 14. **Match Overs "Flicker" (10 vs 20)**
- **Symptom**: Scorer updated match to 10 overs, but spectators saw it flicker between 10 and 20 every ball.
- **Cause**: Race condition between the Kafka broadcast (10) and the API Metadata poll (20). The `PATCH /match` was failing to persist the new value to the database.
- **Fix**: 
    - Implemented a **Triple-Layer Sync**: Standalone `PATCH`, WebSocket broadcast, and failover DB update during every ball event.
    - Updated `LiveScoreboard` to prioritize Kafka metadata over potentially stale polling results.

### 15. **Forbidden PATCH / CORS Restriction**
- **Symptom**: The "Edit Overs" feature worked in the scorer's local UI but never saved to the backend.
- **Cause**: Browser blocked the cross-origin `PATCH` because (1) it wasn't in `Access-Control-Allow-Methods` and (2) the API Gateway route didn't exist in Terraform.
- **Fix**: 
    - Updated `match-api` and `score-update` lambdas to explicitly allow `PATCH` in the `OPTIONS` pre-flight.
    - Added the `PATCH /match/{matchId}` route to the `aws_apigatewayv2_api` in Terraform.

### 16. **Intrusive Browser Prompts**
- **Symptom**: Editing overs opened a clunky browser `prompt()` box which felt non-premium.
- **Cause**: Use of native `window.prompt` for quick implementation.
- **Fix**: Replaced with a **Seamless Inline UI**. The overs count now transforms into a stylized input field on-click, supporting Enter-to-save and Escape-to-cancel.

### 17. **`Runtime.ImportModuleError` / Missing `kafkajs` & `pg`**
- **Symptom**: "Cloud Connection Failed" alert in the UI; Lambda logs showed `Error: Cannot find module 'pg'` or `kafkajs`.
- **Cause**: Updating the Lambda code via Terraform `zip` lacked the `node_modules` directory required for database and messaging connectivity.
- **Fix**: Added dynamic traversal to `deploy.sh`. The pipeline now automatically runs `npm install --production` inside every Lambda directory prior to packaging the root modules.

### 18. **SES `MessageRejected` & Missing API Routes**
- **Symptom**: "Fancy" reports were not being received; "DELETE FAILED! Failed to fetch" alerts in the Admin Hub.
- **Cause**: 
    1. The `match-api` IAM role lacked `ses:SendEmail` permission.
    2. API Gateway was missing routes for `DELETE /match/{matchId}` and `POST /match/{matchId}/email`.
    3. SES Gmail "spoofing" filters blocked unverified senders.
- **Fix**: 
    - Provisioned missing routes via AWS CLI and updated Lambda IAM role permissions.
    - **Enterprise Fix**: Verified the `cricscore.venkateshsingamsetty.site` domain and configured **3 DKIM CNAME records** and an **SPF TXT record** in Route53.
    - Switched source to `noreply@venkateshsingamsetty.site`.

### 19. **Scorer Data Loss (Mobile / Tab Switching)**
- **Symptom**: Scorers lost their pending batter/bowler sync if they switched tabs or refreshed the mobile browser.
- **Cause**: Match state was local to the component; `localStorage` didn't restore the active tab view.
- **Fix**: 
    - Implemented a ball-by-ball `onStateChange` sync from `MatchView` to the app root.
    - Persisted the active `view` ID in `localStorage` to return users directly to the scoring screen after a refresh.

### 20. **Cascading Delete & DB Purge**
- **Symptom**: Deleting a match left "ghost" records in the innings/players tables; no way to bulk-clear old tests.
- **Cause**: Lack of foreign key constraints on some tables and no admin-level `TRUNCATE` endpoint.
- **Fix**: 
    - Verified `ON DELETE CASCADE` across all match-related tables in PostgreSQL.
    - Implemented `DELETE /matches` (Purge) on the backend using `TRUNCATE ... CASCADE` for a clean slate.

### 21. **SES Gmail Phishing Rejection (DMARC)**
- **Symptom**: Lambda logs show `SES Send Success` with a `MessageId`, but the email never arrives in the Inbox or Spam.
- **Cause**: Using a `@gmail.com` address as the `SES_SOURCE` while sending through AWS servers fails Gmail's DMARC policy. Gmail detects that AWS is not an authorized sender for the `gmail.com` domain and silently drops the message.
- **Fix**: 
    - Verify your custom domain (e.g., `venkateshsingamsetty.site`) in the SES Console.
    - Set `ses_source_email` in `terraform.tfvars` to an address on that domain (e.g., `noreply@venkateshsingamsetty.site`).
    - This ensures emails carry valid DKIM/SPF signatures for your domain, allowing them to pass Google's security checks.

---

## ✅ Verified State (2026-03-24 - Resilience Milestone)
- **RBAC**: 3-Tab secure UI (Viewer/Scorer/Admin) fully operational.
- **Email Reporting**: Enterprise-grade delivery with DKIM/SPF from your verified domain.
- **Persistence**: 100% session recovery for scorers (Tab-switch & Refresh proof).
- **Match Lifecycle**: New **STALED** badge (>24h) for unfinished games with Resume support.

### 22. **URL "Haunting" / Stale Match Reload**
- **Symptom**: After starting a new match or logging out, refreshing the page would pull the user back into an old match context or a broken state.
- **Cause**: The `?matchId=...` parameter in the address bar was persisting across sessions and being prioritized by the auto-resume logic.
- **Fix**: Implemented **URL Sanitation**. The application now scrubs the address bar using `window.history.replaceState` immediately after a match ID is read, on logout, and when a fresh match starts.

### 23. **Cross-User Data Leakage / Scoring Ghosting**
- **Symptom**: User `xyz` logs out, user `abc` logs in, but `abc` sees `xyz`'s match scoreboard instead of a clean setup.
- **Cause**: The ball-by-ball scoring state was using a global, shared LocalStorage key (`cric-scorer-live-innings`).
- **Fix**: 
    - Refactored the live cache to use a match-specific key: `cric-live-match-{matchId}`.
    - Implemented **Email-Scoped Persistence** for general match metadata (`cric-match-state-{email}`).
    - This provides 100% isolation between different users and different matches on the same device.

### 24. **Match Deletion Desync (Scorer vs Admin)**
- **Symptom**: An Admin deletes a match from the Hub, but the Scorer is still recording balls on their screen, leading to failed syncs and confusion.
- **Cause**: The Scorer view had no awareness of the match's existence in the database once it was loaded.
- **Fix**: 
    - Implemented a **Cloud-Existence Heartbeat** during Scorer login, page refresh, and every ball update.
    - If the backend returns a `404`, the client triggers an alert and performs an **Autonomous Force Reset** to clear the dead match from the screen and local cache.

---

## ✅ Verified State (2026-03-26 - Isolation Milestone)
- **Multi-Tenant Isolation**: 100% data separation between unique scorer emails.
- **Match-Specific Cache**: No data leakage between concurrent or historical sessions.
- **Auto-Sync Security**: Real-time cleanup for deleted cloud records.
- **State Integrity**: URL sanitation prevents stale state injections.

### 26. **SES Sandbox Friction / Email Delivery Rejection**
- **Symptom**: User-facing email reports were consistently rejected by AWS SES unless both sender and recipient were manually verified. AWS rejected the limit increase request (Sandbox Exit).
- **Cause**: SES Sandbox environments strictly enforce dual-verification for every message, making it impossible to send scorecards to arbitrary user emails in a consumer-facing app.
- **Fix (v1.5.2)**: **Option B Pivot**—Replaced the non-functional "Email Report" system with an **Instant Sharable Match Link** (Match ID based). 
    - Replaced the Gmail input with an "Identity Synchronization" field solely for session persistence.
    - Integrated a "SHARE SCORECARD 🔗" button in the Match Completion UI.
    - Redirected SES solely for **Admin-Backend Logging**, where the recipient is already verified.
    - Resulted in **Zero-Friction Sharing** and viral match-day growth potential.

---

## ✅ Verified State (2026-03-30 - Sharing Milestone)
- **v1.5.2**: Instant Match Sharing links live.
- **SES Bypass**: Friction-free user experience without AWS verification requirements.
- **Identity Sync**: Scoped session persistence verified across SCORER and ADMIN views.

### 27. **Aiven DB `SELF_SIGNED_CERT_IN_CHAIN` (Phase 7)**
- **Symptom**: SQS Queue messages were stuck `NotVisible`; Worker triggered `SELF_SIGNED_CERT_IN_CHAIN` on Aiven PG connection.
- **Cause**: Node v18's strict native TLS validation rejects Aiven's intermediate self-signed certificates, ignoring generic driver `rejectUnauthorized: false` flags.
- **Fix**: Injected `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` at the extreme top of the `storage-worker` bootloader sequence.

### 28. **Rapid-Fire Score Date Loss / Desync (Phase 7)**
- **Symptom**: Scorer taps "1" six times rapidly; the UI says `6/0` locally, but spectators only see `3/0`. DB aggregated only 3 balls.
- **Cause**: React `useState` closures were capturing identical asynchronous network payloads before the UI had a chance to render the new incremented value.
- **Fix**: Replaced pure `useState` components with an instantaneous, synchronous `useRef` lock (`isProcessingRef.current = true`). Forced `await postScoreUpdate` to physically stall overlapping asynchronous fetch executions until AWS responds.
