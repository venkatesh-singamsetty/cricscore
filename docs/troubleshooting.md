# 🚀 Troubleshooting & Fix Log

This engineering trace documents the real-world resolutions for the CricScore backend integration.

### 46. **CodeQL Flagging Playwright HTML Reports (XSS)**

- **Symptom**: CodeQL static analysis failed the CI/CD pipeline, citing Cross-Site Scripting (XSS) vulnerabilities inside the `playwright-report/index.html` file.
- **Cause**: Playwright generates a local HTML report of test results which got accidentally tracked by Git. CodeQL aggressively scans all HTML files in the repo and flags the generated UI templates.
- **Fix**: Added `playwright-report/` and `test-results/` to the `.gitignore` and removed the tracked files from the repository to prevent SAST scanners from parsing generated test artifacts.

### 45. **Checkov SARIF Upload Permission Denied**

- **Symptom**: The `upload-sarif` step in the Checkov GitHub Action failed with `Resource not accessible by integration`.
- **Cause**: The GitHub Action was missing the `security-events: write` permission required to publish vulnerabilities to the GitHub Code Scanning dashboard.
- **Fix**: Injected `permissions: security-events: write` explicitly into the `backend-infra.yml` job.

### 44. **Playwright Polluting Production Database**

- **Symptom**: Dozens of duplicate "CHICAGO SPARTANS vs SHARK BLUE" matches appeared on the live `cricscore.venkateshsingamsetty.site` viewer dashboard with broken scores (like `4/1` after 0.2 overs).
- **Cause**: The Playwright configuration defaults to testing against the live production URL. Running `npx playwright test` locally was creating authentic database entries without cleaning them up upon failure or timeout.
- **Fix**: Connected directly to the Aiven PostgreSQL production database via `psql` and executed a targeted cleanup: `DELETE FROM matches WHERE team_a_name = 'CHICAGO SPARTANS' AND team_b_name = 'SHARK BLUE';`.

### 43. **Optimistic UI Lock Race Condition in E2E Tests**

- **Symptom**: Playwright E2E tests intermittently dropped actions (e.g., failed to register a Wicket) and timed out waiting for the next step.
- **Cause**: The React frontend uses an optimistic `isProcessingRef` lock during the `/api/live/ball` fetch. Playwright clicked buttons faster than the network could respond, causing subsequent clicks to hit the `return` guard inside the locked function.
- **Fix**: Added an explicit `waitForTimeout(2000)` to forcefully synchronize Playwright with the backend latency and UI unlock sequence.

### 42. **E2E Playwright Tests Hallucinating UI Elements**

- **Symptom**: End-to-End tests failed with `locator.click: Target closed` when trying to click `"Match Settings"`, `"Toss Details"`, or `"Confirm"` buttons.
- **Cause**: The test scripts were hallucinating or using legacy UI flows that did not exist in the current application state.
- **Fix**: Rewrote `user-journey.spec.ts` to strictly follow the true DOM structure, relying on deterministic inputs (`BATTER_A`, `BATTER_B`) and exact `.first()` and `{ force: true }` click targets to bypass React fading animations.

### 41. **React 19 `act(...)` Unmounting Warnings**

- **Symptom**: Vitest logs flooded with `An update to MatchSetup inside a test was not wrapped in act(...)`.
- **Cause**: React 19 strictly enforces state update wrapping. Asynchronous state changes (like timeouts or promises) resolving after a test completed were triggering state mutations on unmounted components.
- **Fix**: Ensured all asynchronous test interactions are strictly wrapped inside `await act(async () => { ... })`.

### 40. **GitHub Actions Trigger Path Ignored**

- **Symptom**: You fix a broken file (like `backend/package-lock.json`), commit, and push it, but the GitHub Actions pipeline completely ignores it and doesn't run, leaving your PR in a permanently failed state.
- **Cause**: The `.github/workflows/*.yml` file has an overly restrictive `paths:` filter (e.g., `- 'backend/lambdas/**'`) which tells GitHub to only trigger if files deep inside the lambdas folder are changed. Since the `package-lock.json` was in the parent folder, it was ignored.
- **Fix**: Broadened the pipeline trigger path to `- 'backend/**'` so any code, dependency, or configuration change inside the entire backend ecosystem reliably triggers a validation pipeline.

### 39. **`npm ci` Pipeline Crash (`npm error EUSAGE`)**

- **Symptom**: The backend validation pipeline fails instantly during the `Install Lambda dependencies` step. The logs show a wall of `npm error` help text and `Process completed with exit code 1`.
- **Cause**: `npm ci` (Clean Install) strictly requires that your `package.json` and `package-lock.json` are perfectly synchronized. If dependencies drift, `npm ci` purposefully crashes to prevent deploying non-deterministic dependencies.
- **Fix**: Executed `npm install` locally inside every folder containing a `package.json` to force the generation of perfectly synchronized lockfiles. Pushed the new `package-lock.json` files to unblock the pipeline.

### 38. **Aiven Free Tier Database Auto-Pause (Inactivity Shutdown)**

- **Symptom**: The CricScore backend suddenly stops working after a few days of inactivity. Logs show database connection timeouts.
- **Cause**: Aiven's Free Tier automatically pauses PostgreSQL instances if they receive exactly zero connections for 3 consecutive days to save resources.
- **Fix**: Created `.github/workflows/keepalive.yml` which runs a scheduled CRON job every 24 hours. The GitHub Action connects to the database and executes `SELECT 1;`, permanently preventing the inactivity timeout.

### 37. **DAST Scanner Opening Repetitive Informational Issues**

- **Symptom**: OWASP ZAP runs daily via cron and opens a new GitHub Issue every night for missing security headers (like COEP/COOP) that were intentionally omitted.
- **Cause**: ZAP is a strict baseline scanner and flags any relaxed security postures, even if they are required for React/Vite functionality or external API connectivity.
- **Fix**: Created `.zap/rules.tsv` to explicitly instruct ZAP to `IGNORE` specific rule IDs (e.g., `10055`, `90004`). Hooked the rules file into the `zaproxy/action-baseline` execution to permanently silence intentional configuration warnings.

### 36. **Node 20 / Punycode Deprecation Warnings in GitHub Actions**

- **Symptom**: DAST and CI pipelines throw `Node 20 is being deprecated` or `[DEP0040] DeprecationWarning: The punycode module is deprecated` warnings.
- **Cause**: Legacy actions like `actions/checkout@v4` and the internal dependencies of `zaproxy/action-baseline` rely on older Node modules. Forcing Node 24 causes it to complain about these native internal modules.
- **Fix**: Upgraded `actions/checkout` directly to `v7` to natively support Node 24. For the ZAP plugin, injected `NODE_OPTIONS: "--no-deprecation"` to globally silence Node 24 from printing internal dependency warnings to the pipeline console.

### 35. **OWASP ZAP Artifact Upload Crash (400 Bad Request)**

- **Symptom**: DAST pipeline fails at the very end with `Create Artifact Container - Error is not retryable`.
- **Cause**: The `zaproxy/action-baseline@v0.12.0` relies on legacy `upload-artifact@v3` API, which is blocked by GitHub's strict v4 validation schema.
- **Fix**: Bumped the plugin version to `v0.15.0`, which implements the v4 artifact architecture natively and eliminates Node 20 deprecation warnings.

### 34. **OWASP ZAP Pipeline `Errno 13 Permission denied`**

- **Symptom**: ZAP Docker container fails to generate `zap.yaml` or output HTML reports in GitHub Actions.
- **Cause**: The ZAP container runs internally as the `zap` user, but the mounted GitHub workspace is owned by `runner`.
- **Fix**: Inserted an explicit `chmod -R 777 ${{ github.workspace }}` step before the ZAP baseline action runs.

### 33. **GitHub Action `Resource not accessible by integration` (Issue Creation)**

- **Symptom**: Pipeline fails when OWASP ZAP tries to create a GitHub Issue containing the security warnings.
- **Cause**: Default GitHub Action tokens are read-only and lack `issues: write` permission.
- **Fix**: Added explicit `permissions: issues: write` and `contents: read` strictly to the DAST job configuration.

### 32. **Local Deployment Failures (Missing Dependencies)**

- **Symptom**: New developers failed to run `./deploy.sh` locally because fundamental CLI utilities were missing.
- **Cause**: Lack of an automated bootstrap procedure across Mac and Linux systems.
- **Fix**: Completely rebuilt `scripts/setup.sh` into an intelligent, OS-aware installer that automatically detects missing tools (`node@24`, `terraform`, `aws-cli`, `jq`) and provisions them natively via `brew` or `apt`.

### 31. **CI/CD Hardcoded Infrastructure Drift**

- **Symptom**: CI/CD pipelines ran correctly but lacked environment portability due to hardcoded AWS domains and buckets.
- **Cause**: The `.github/workflows/backend-infra.yml` file had hardcoded deployment parameters.
- **Fix**: Removed hardcoded strings (`cricscore...site`) and injected dynamic GitHub context variables (`${{ vars.DOMAIN_NAME }}`) directly into the pipeline execution paths.

### 30. **Frontend `.env` Overwrite Data Loss**

- **Symptom**: Running local deployment scripts wiped out manual environment variables (like `VITE_ADMIN_PIN`) from `frontend/.env`.
- **Cause**: `deploy.sh` and `sync-env.sh` were destructively regenerating the file from scratch instead of updating it.
- **Fix**: Deleted legacy scripts. Refactored `deploy.sh` to safely _append_ live AWS API Gateway endpoints to the `frontend/.env` file non-destructively, permanently preserving manual configuration.

### 29. **Terraform Variable Hydration Failure (`TF_VAR_`)**

- **Symptom**: Terraform `apply` failed to pick up variables from the local environment or GitHub Actions, throwing "Missing required variable" errors.
- **Cause**: Standard environment variable names in `.env.local` were all uppercase (`DOMAIN_NAME`), which broke Terraform's strict lowercase prefix requirement (`TF_VAR_domain_name`).
- **Fix**: Re-engineered `deploy.sh` to automatically convert and export standard ALL CAPS variables into the required Terraform format (`export TF_VAR_domain_name=$DOMAIN_NAME`) prior to execution, protecting the developer experience and keeping `.env.local` clean.

### 28. **Rapid-Fire Score Date Loss / Desync (Phase 7)**

- **Symptom**: Scorer taps "1" six times rapidly; the UI says `6/0` locally, but spectators only see `3/0`. DB aggregated only 3 balls.
- **Cause**: React `useState` closures were capturing identical asynchronous network payloads before the UI had a chance to render the new incremented value.
- **Fix**: Replaced pure `useState` components with an instantaneous, synchronous `useRef` lock (`isProcessingRef.current = true`). Forced `await postScoreUpdate` to physically stall overlapping asynchronous fetch executions until AWS responds.

### 27. **Aiven DB `SELF_SIGNED_CERT_IN_CHAIN` (Phase 7)**

- **Symptom**: SQS Queue messages were stuck `NotVisible`; Worker triggered `SELF_SIGNED_CERT_IN_CHAIN` on Aiven PG connection.
- **Cause**: Node v24's strict native TLS validation rejects Aiven's intermediate self-signed certificates, ignoring generic driver `rejectUnauthorized: false` flags.
- **Fix**: Injected `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` at the extreme top of the `storage-worker` bootloader sequence.

### 26. **SES Sandbox Friction / Email Delivery Rejection**

- **Symptom**: User-facing email reports were consistently rejected by AWS SES unless both sender and recipient were manually verified. AWS rejected the limit increase request (Sandbox Exit).
- **Cause**: SES Sandbox environments strictly enforce dual-verification for every message, making it impossible to send scorecards to arbitrary user emails in a consumer-facing app.
- **Fix (v1.5.2)**: **Option B Pivot**—Replaced the non-functional "Email Report" system with an **Instant Sharable Match Link** (Match ID based).
  - Replaced the Gmail input with an "Identity Synchronization" field solely for session persistence.
  - Integrated a "SHARE SCORECARD 🔗" button in the Match Completion UI.
  - Redirected SES solely for **Admin-Backend Logging**, where the recipient is already verified.
  - Resulted in **Zero-Friction Sharing** and viral match-day growth potential.

### 24. **Match Deletion Desync (Scorer vs Admin)**

- **Symptom**: An Admin deletes a match from the Hub, but the Scorer is still recording balls on their screen, leading to failed syncs and confusion.
- **Cause**: The Scorer view had no awareness of the match's existence in the database once it was loaded.
- **Fix**:
  - Implemented a **Cloud-Existence Heartbeat** during Scorer login, page refresh, and every ball update.
  - If the backend returns a `404`, the client triggers an alert and performs an **Autonomous Force Reset** to clear the dead match from the screen and local cache.

### 23. **Cross-User Data Leakage / Scoring Ghosting**

- **Symptom**: User `xyz` logs out, user `abc` logs in, but `abc` sees `xyz`'s match scoreboard instead of a clean setup.
- **Cause**: The ball-by-ball scoring state was using a global, shared LocalStorage key (`cricscore-live-innings`).
- **Fix**:
  - Refactored the live cache to use a match-specific key: `cric-live-match-{matchId}`.
  - Implemented **Email-Scoped Persistence** for general match metadata (`cric-match-state-{email}`).
  - This provides 100% isolation between different users and different matches on the same device.

### 22. **URL "Haunting" / Stale Match Reload**

- **Symptom**: After starting a new match or logging out, refreshing the page would pull the user back into an old match context or a broken state.
- **Cause**: The `?matchId=...` parameter in the address bar was persisting across sessions and being prioritized by the auto-resume logic.
- **Fix**: Implemented **URL Sanitation**. The application now scrubs the address bar using `window.history.replaceState` immediately after a match ID is read, on logout, and when a fresh match starts.

### 21. **SES Gmail Phishing Rejection (DMARC)**

- **Symptom**: Lambda logs show `SES Send Success` with a `MessageId`, but the email never arrives in the Inbox or Spam.
- **Cause**: Using a `@gmail.com` address as the `SES_SOURCE` while sending through AWS servers fails Gmail's DMARC policy. Gmail detects that AWS is not an authorized sender for the `gmail.com` domain and silently drops the message.
- **Fix**:
  - Verify your custom domain (e.g., `example.com`) in the SES Console.
  - Set `TF_SES_SOURCE_EMAIL` in `.env.local` to an address on that domain (e.g., `noreply@example.com`).
  - This ensures emails carry valid DKIM/SPF signatures for your domain, allowing them to pass Google's security checks.

### 20. **Cascading Delete & DB Purge**

- **Symptom**: Deleting a match left "ghost" records in the innings/players tables; no way to bulk-clear old tests.
- **Cause**: Lack of foreign key constraints on some tables and no admin-level `TRUNCATE` endpoint.
- **Fix**:
  - Verified `ON DELETE CASCADE` across all match-related tables in PostgreSQL.
  - Implemented `DELETE /matches` (Purge) on the backend using `TRUNCATE ... CASCADE` for a clean slate.

### 19. **Scorer Data Loss (Mobile / Tab Switching)**

- **Symptom**: Scorers lost their pending batter/bowler sync if they switched tabs or refreshed the mobile browser.
- **Cause**: Match state was local to the component; `localStorage` didn't restore the active tab view.
- **Fix**:
  - Implemented a ball-by-ball `onStateChange` sync from `MatchView` to the app root.
  - Persisted the active `view` ID in `localStorage` to return users directly to the scoring screen after a refresh.

### 16. **`SES MessageRejected` & Missing API Routes**

- **Symptom**: "Fancy" reports were not being received; "DELETE FAILED! Failed to fetch" alerts in the Admin Hub.
- **Cause**:
  1. The `match-api` IAM role lacked `ses:SendEmail` permission.
  2. API Gateway was missing routes for `DELETE /match/{matchId}` and `POST /match/{matchId}/email`.
  3. SES Gmail "spoofing" filters blocked unverified senders.
- **Fix**:
  - Provisioned missing routes via AWS CLI and updated Lambda IAM role permissions.
  - **Enterprise Fix**: Verified the `cricscore.example.com` domain and configured **3 DKIM CNAME records** and an **SPF TXT record** in Route53.
  - Switched source to `noreply@example.com`.

### 15. **`Runtime.ImportModuleError` / Missing `pg`**

- **Symptom**: "Cloud Connection Failed" alert in the UI; Lambda logs showed `Error: Cannot find module 'pg'`.
- **Cause**: Updating the Lambda code via Terraform `zip` lacked the `node_modules` directory required for database connectivity.
- **Fix**: Added dynamic traversal to `deploy.sh`. The pipeline now automatically runs `npm install --production` inside every Lambda directory prior to packaging the root modules.

### 14. **Intrusive Browser Prompts**

- **Symptom**: Editing overs opened a clunky browser `prompt()` box which felt non-premium.
- **Cause**: Use of native `window.prompt` for quick implementation.
- **Fix**: Replaced with a **Seamless Inline UI**. The overs count now transforms into a stylized input field on-click, supporting Enter-to-save and Escape-to-cancel.

### 13. **Forbidden PATCH / CORS Restriction**

- **Symptom**: The "Edit Overs" feature worked in the scorer's local UI but never saved to the backend.
- **Cause**: Browser blocked the cross-origin `PATCH` because (1) it wasn't in `Access-Control-Allow-Methods` and (2) the API Gateway route didn't exist in Terraform.
- **Fix**:
  - Updated `match-api` and `score-update` lambdas to explicitly allow `PATCH` in the `OPTIONS` pre-flight.
  - Added the `PATCH /match/{matchId}` route to the `aws_apigatewayv2_api` in Terraform.

### 12. **Match Overs "Flicker" (10 vs 20)**

- **Symptom**: Scorer updated match to 10 overs, but spectators saw it flicker between 10 and 20 every ball.
- **Cause**: Race condition between the WebSocket broadcast (10) and the API Metadata poll (20). The `PATCH /match` was failing to persist the new value to the database.
- **Fix**:
  - Implemented a **Triple-Layer Sync**: Standalone `PATCH`, WebSocket broadcast, and failover DB update during every ball event.
  - Updated `LiveScoreboard` to prioritize WebSocket metadata over potentially stale polling results.

### 11. **Match Hub Consolidation & Layout Clarity**

- **Symptom**: Redundant "Fans Live" vs "Old Matches" tabs; missing bowling team name; confused striker position.
- **Cause**: Tab clutter led to navigation fatigue; UI was missing contextual team labels in the scoring header.
- **Fix**:
  - Merged into a unified **Match Hub** sorted by newest matches first with `LIVE` vs `COMPLETED` badges.
  - Added the bowling team name to all headers and cards.
  - Implemented a `.sort()` pinned-striker logic to ensure the facing batsman is always at the top for fans.

### 10. **The "Less Score" Bug (Missing Sync Totals)**

- **Symptom**: After fixing double-counting, spectators saw a LOWER score than the scorer (stuck on the previous ball).
- **Cause**: The `postScoreUpdate` frontend sync was missing the `totalRuns` and `totalWickets` fields, sending `null` to the backend.
- **Fix**: Refactored `postScoreUpdate` to send the complete, finalized `InningsState` totals in every message.

### 9. **The "1 Run Extra" Bug (Double-Counting)**

- **Symptom**: After a ball or undo, the spectator view consistently showed exactly one more run than the scorer.
- **Cause**: The backend was performing two overlapping updates: one to `SET` the total score and another to `INCREMENT` it by the ball's runs.
- **Fix**: Removed the redundant increment logic; the system now treats the scorer's transmitted total as the absolute source of truth.

### 8. **Aggregate Stat Mismatch on Undo**

- **Symptom**: After undoing a ball, the team score reverted, but individual batter/bowler runs and wickets in the "Match Analytics" modal stayed high.
- **Cause**: The backend only reverted the `innings` table totals but didn't subtract runs from the `players` or `bowlers` aggregate tables.
- **Fix**: Updated the `score-update` lambda to fetch the last ball before deletion, identify the participating players, and explicitly subtract their personal runs/wickets/balls to restore perfect analytics consistency.

### 7. **Undo Score Mismatch / Ghost Balls**

- **Symptom**: Clicking "Undo" reverted the scorer's screen but left spectators with the old score or "ghost" balls in the timeline.
- **Cause**: Undo only reverted local state; the DB still held the undone ball record, and shallow-copy mutations leaked into the history logs.
- **Fix**:
  - Updated `handleUndo` to send a `DELETE` request to the backend for the last ball event.
  - Implemented a **Full State Sync** to overwrite DB totals immediately after an undo.
  - Refactored frontend to use **Strict Immutability** to prevent history log corruption.

### 6. **Match Creation Latency**

- **Symptom**: Starting a new match took several seconds.
- **Cause**: Sequential `INSERT` statements for 22+ players/bowlers caused multiple round-trips to the DB.
- **Fix**: Implemented **Bulk SQL Inserts** and Transactions in the `match-api`, reducing round-trips from ~25 to 4.

### 5. **New Bowler Showing High Over Count**

- **Symptom**: A bowler starting the 2nd over was incorrectly showing `1.1` overs instead of `0.1` in the spectator view.
- **Cause**: Backend was calculating bowler figures based on the global `overNumber` index instead of their individual spell count.
- **Fix**:
  - Updated `MatchView` to explicitly track and send `bowlerOvers` and `bowlerBalls` to the backend.
  - Updated `score-update` lambda to prioritize these explicit personal figures when updating the `bowlers` table.

### 4. **Overs Showing One Less / Active Player Lag**

- **Symptom**: After the 6th ball, the score showed 2.0 instead of 3.0 for several seconds. Also, spectators saw "Waiting for first ball" despite players being selected.
- **Cause**: Backend relied on the ball's current over ID rather than the resulting total; crease state was only saved during ball events.
- **Fix**:
  - Updated `MatchView` to explicitly pass `totalOvers` and `totalBalls` in every sync.
  - Added `syncOnly` mode to `score-update` lambda to persist player roles immediately upon selection.
  - Filtered `LiveScoreboard` summary to strictly show currently playing batsmen.

### 3. **Fans Live "White Screen" / Stale Old Matches**

- **Symptom**: "Fans Live" appeared empty/white unless a match was LIVE. Switching to "Old Matches" didn't show new records without a browser refresh.
- **Cause**: React was reusing component instances without re-fetching; conditional rendering in `App.tsx` was too restrictive.
- **Fix**:
  - Added `key={view}` to `LiveScoreboard` to force remount on tab change.
  - Refactored `LiveScoreboard` to show DB snapshot data (Batters/Bowlers) immediately if WebSocket broadcast is pending.

### 2. **Empty Match Analytics / Missing History**

- **Symptom**: "Old Matches" or "Analytics" modal was empty (0 runs, 0 players).
- **Cause**: Squad data was only in-memory; `players` and `bowlers` tables in DB were never initialized or updated.
- **Fix**:
  - Updated `match-api` to initialize squads in DB during `POST /match`.
  - Updated `score-update` lambda to `UPDATE` aggregate stats in DB for every ball.
  - Added `striker_name` / `non_striker_name` tracking to the `innings` table.

### 1. **`Connection Timeout` (Phase 3)**

- **Symptom**: `LambdaTimeout: 30s` exceeded during ball scoring.
- **Cause**: Initial 3s timeout + 128MB RAM was too slow for (1) PG SSL handshake + (2) SQL write operations.
- **Fix**:
  - Increased memory to **256MB** (Giving the Lambda more CPU power for encryption).
  - Hardened the timeout to **30s**.
