---
name: cricscore-testing-standards
description: Use when adding, changing, or selecting tests for CricScore frontend, backend, ML inference, AI chat, or deployed-site behavior.
---

# CricScore Testing Standards

Every feature or bug fix must be accompanied by automated regression tests across the affected layers and documented in `docs/testing.md`.

## 1. Test Layers & Exact Commands

1. **Frontend Unit & Component Tests (`apps/frontend/src/test/*.test.{ts,tsx}`)**:
   - Runner: Vitest + React Testing Library + JSDOM (`npm --prefix apps/frontend test -- --run`).
   - Key suites:
     - `MatchView.test.tsx`: Scorer cockpit, 1st-innings auto-end modal, `← Back to 1st Innings` inline `Undo Last Ball` + `Proceed to 2nd Innings`, refresh-safe undo reconstruction from `allBalls`, centered `🎯 X OFF Y` target pill.
     - `LiveScoreboard.test.tsx`: WebSocket strike-rotation batter attribution (`ballData.batterName`), `explicitTotalRuns`, and `undo: true` handling.
     - `AiMatchPrediction.test.tsx`: 50-50 baseline, impossible chase guard (`runsNeeded > ballsLeft * 6`), and dynamic `ballsLeft`/`ballsBowled` payload.
     - `applyLiveScoreToMatches.test.ts` & `dlsUtils.test.ts`: Cumulative score reconciliation and 1–20 over DLS par calculations.
     - `ChatComponent.test.tsx` & `MatchSetup.test.tsx`: AI assistant quick chips, mobile wizard, and roster validation.
   - **Clean Async Rule**: Always `await waitFor(...)` when components trigger `fetch` inside `useEffect` so Vitest runs with zero React `act(...)` warnings.
2. **Backend Lambda Unit Tests (`apps/backend/lambdas/**/*.test.js`)**:
   - Runner: Vitest (`npm --prefix apps/backend test`).
   - Covers `match-api` (including idempotent 2nd-innings `ON CONFLICT` upsert and `inn2_<timestamp>` resolution on match completion), `score-update`, `storage-worker` (`explicitTotalRuns` on normal balls and `undo: true`), `broadcaster`, `onconnect`, `ondisconnect`, and `chat-api` (handlers + MCP tools).
3. **ML Engine Inference Tests (`apps/ml-engine/test_predict.py`)**:
   - Runner: Pytest (`./apps/ml-engine/venv/bin/pytest apps/ml-engine/test_predict.py`).
   - Covers 1-over, 5-over, and 20-over match formats, 1st-innings par projections, 2nd-innings Hybrid DP + DLS alignment (`_chase_win_prob_dp` + `_dls_resource_remaining`), and terminal chase boundaries.
4. **End-to-End Browser & API Tests (`apps/e2e/tests/*.spec.ts`)**:
   - Runner: Playwright (`cd apps/e2e && npx playwright test --reporter=list`).
   - **Fail-Fast Configuration (`apps/e2e/playwright.config.ts`)**: Always keep `actionTimeout: 15000`, `navigationTimeout: 30000`, and `reporter: [["html", { open: "never" }]]` so a broken locator fails in 15 seconds instead of hanging CI for 15 minutes (`3 retries x 5m`).
   - **UI Synchronization (`apps/e2e/tests/user-journey.spec.ts`)**: `user-journey.spec.ts` runs a full 2-over match against `dev` and `prod`. Because `MatchSetup.tsx` defaults team names to `"CHICAGO SPARTANS"` and `"ILLINOIS THUNDERS"`, `user-journey.spec.ts` must explicitly fill `"TEAM A"` and `"TEAM B"` into the team name inputs and match current UI headings (`/Live Timeline|This Over/i`).

## 2. Full Local Validation Suite

- Run `./infra/scripts/validate_local.sh --skip-e2e` for fast pre-push validation, or `./infra/scripts/validate_local.sh` to include live Playwright E2E against `dev` (`https://cricscoredev.venkateshsingamsetty.com`).
