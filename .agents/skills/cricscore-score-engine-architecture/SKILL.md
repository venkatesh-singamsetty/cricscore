---
name: cricscore-score-engine-architecture
description: Architectural specifications, event schema definitions, state sync mechanics, and debugging guidelines for the CricScore live score calculation engine.
---

# CricScore Score Engine Architecture Skill

This skill documents the core live score calculation, event ordering, and state sync mechanisms for the CricScore application.

## 1. Domain Event Flow

1. **Match API (`apps/backend/lambdas/match-api`)**: Accepts ball-by-ball updates or admin score edits via API Gateway.
2. **Score Update Worker (`apps/backend/lambdas/score-update`)**: Processes incoming ball events, computes running overs/wickets/runs, updates PostgreSQL RDS, and emits `LIVE_SCORE_UPDATE` or `STATE_SYNC` events.
3. **SNS / SQS Fan-Out**: Broadcasts score updates to WebSocket API connections (`chat-api` / WebSocket gateway) and long-term storage worker.

## 2. Scoreboard & Overs Calculation Rules

- **Active Ball Score Display**: Active score in the Live Scoreboard must always be prefixed with the current batting team name (e.g., `TEAM A: 45/2 (5.3 ov)`).
- **Overs Notation**:
  - `5.1` = 5 overs completed, 1st ball of 6th over.
  - `5.5` = 5 overs completed, 5th ball of 6th over.
  - `6.0` = 6 completed overs.
- **Match Result State**: Scoreboard final match result (e.g. `Team A won by 10 runs`) must only render when `isCompleted` is `true`.

## 3. Testing & Verification

Run unit tests for score calculation Lambdas:

```bash
(cd apps/backend && npx vitest run lambdas/score-update/index.test.js)
```
