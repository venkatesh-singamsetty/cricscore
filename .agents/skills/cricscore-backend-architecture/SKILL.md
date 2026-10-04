---
name: cricscore-backend-architecture
description: Architectural specifications, event schema definitions, state sync mechanics, and debugging guidelines for the CricScore backend.
---

# CricScore Backend Architecture Skill

This skill documents the core live score calculation, event ordering, and state sync mechanisms for the CricScore application.

## 1. Domain Event Flow

1. **Match API (`apps/backend/lambdas/match-api`)**: Accepts ball-by-ball updates or admin score edits via API Gateway.
2. **Score Update Worker (`apps/backend/lambdas/score-update`)**: Processes incoming ball events, computes running overs/wickets/runs, updates PostgreSQL RDS, and emits `LIVE_SCORE_UPDATE` or `STATE_SYNC` events.
3. **SNS / SQS Fan-Out**: Broadcasts score updates to WebSocket API connections (`chat-api` / WebSocket gateway) and long-term storage worker.

## 2. Database Connection Pooling (PostgreSQL RDS)

- Always use **pg.Pool** or AWS RDS Proxy for Lambda connections to prevent connection exhaustion (`max_connections exceeded`).
- Ensure `pool.end()` or connection reuse patterns are maintained in serverless handlers outside the function execution body.

## 3. Testing & Verification

Run unit tests for score calculation Lambdas:
`(cd apps/backend && npx vitest run lambdas/score-update/index.test.js)`
