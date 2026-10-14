---
name: cricscore-backend-architecture
description: Use when changing CricScore Node.js Lambda APIs, scoring and event processing, PostgreSQL access, persistence, or WebSocket state synchronization.
---

# CricScore Backend Architecture Skill

Use `apps/backend/lambdas/README.md`, the relevant Lambda code, and Terraform as the current architecture references. Confirm event ownership and payload contracts in code before changing a flow.

## Runtime boundaries

- Each Lambda owns a distinct API, event, or delivery responsibility. Preserve the existing boundaries and message schemas; verify producers and consumers together when changing an event.
- Score calculations must distinguish legal deliveries from extras and retirement events. Keep event ordering, persistence, broadcast state, and undo behavior consistent.
- PostgreSQL is Aiven-hosted. Reuse the configured `pg.Pool` pattern in warm Lambda environments, avoid creating a pool per invocation, and do not log connection strings or sensitive query results.
- Use transactions where a logical update spans multiple related rows. Parameterize SQL values and validate inputs at API boundaries.

## Verification

Add regression tests beside the affected Lambda. Run `(cd apps/backend && npm test)` for backend changes; include relevant API, persistence, event-consumer, and undo tests when behavior crosses boundaries.
