---
name: cricscore-backend-architecture
description: Use when changing CricScore Node.js Lambda APIs, scoring and event processing, PostgreSQL access, persistence, or WebSocket state synchronization.
---

# CricScore Backend Architecture

Use `apps/backend/lambdas/README.md`, `docs/websocket_tutorial.md`, and `infra/terraform/lambda.tf` as references. Verify event schemas across producers (`score-update`) and consumers (`storage-worker`, `broadcaster`, `LiveScoreboard`) before changing any contract.

## 1. Lambda Responsibilities & Event Flow

- **`match-api` (`apps/backend/lambdas/match-api/index.js`)**:
  - Owns REST endpoints for `/health`, `/matches`, `/match`, `/match/{matchId}`, `/match/{matchId}/details`, `/match/{matchId}/innings`, and `/match/{matchId}/crease`.
  - **Idempotent 2nd-Innings Upsert**: `POST /match/{matchId}/innings` must use `ON CONFLICT (match_id, inning_number) DO UPDATE` so retries or undo-and-reproceed flows never fail with unique constraint errors (`23505`).
  - **Canonical `inning_id` Resolution**: In `PATCH /match/{matchId}` (`COMPLETED`), if `finalInnings.id` starts with `inn2_`, resolve the canonical UUID from `innings WHERE match_id = $1 AND inning_number = 2` before updating `total_runs`, `total_wickets`, `overs`, and `balls`.
- **`score-update` (`apps/backend/lambdas/score-update/index.js`)**:
  - Validates incoming ball/undo payloads and fans out simultaneously to SNS (`MATCH_EVENTS_TOPIC` -> `broadcaster`) and SQS FIFO (`STORAGE_QUEUE_URL` -> `storage-worker`).
- **`storage-worker` (`apps/backend/lambdas/storage-worker/index.js`)**:
  - Consumes SQS FIFO batches and commits ACID transactions to Aiven PostgreSQL.
  - **Authoritative Totals (`explicitTotalRuns` / `explicitTotalWickets`)**: Always prefer `explicitTotalRuns` and `explicitTotalWickets` when updating the `innings` row on both normal deliveries and `undo: true` events so out-of-order or retried events never cause cumulative score drift.
  - **Resolve `inn2_<timestamp>` IDs**: When `ballData.inningId` starts with `inn2_`, look up or create the canonical 2nd-innings row in `innings` before inserting/deleting `balls`.
- **WebSocket Session & Fan-Out (`onconnect`, `ondisconnect`, `broadcaster`)**:
  - Tracks connection IDs in DynamoDB (`websocket_connections`) and prunes stale `410 GoneException` connections automatically during broadcast.

## 2. Database & Runtime Guardrails

- **Warm Connection Pool Reuse**: Always reuse a module-scoped `pg.Pool` across Lambda invocations; never instantiate a new pool inside `handler` or call `pool.end()` per request.
- **Parameterized SQL**: Use `$1, $2, ...` placeholders for all SQL parameters and wrap multi-table writes (`balls` + `innings`) in `BEGIN` / `COMMIT` / `ROLLBACK` transactions.

## 3. Verification

- Add or update unit tests in `apps/backend/lambdas/<lambda>/index.test.js` and run `npm --prefix apps/backend test` and `npm --prefix apps/backend audit --audit-level=high`.
