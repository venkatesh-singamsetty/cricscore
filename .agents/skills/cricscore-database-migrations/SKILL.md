---
name: cricscore-database-migrations
description: Use when changing PostgreSQL schemas, SQL migrations, indexes, seed data, or deploying database changes to CricScore dev or prod.
---

# CricScore Database Migration Standards

## 1. Environment & Execution Model

- **Schema Isolation on Aiven PostgreSQL**: CricScore uses a single Aiven PostgreSQL instance with isolated `dev` and `prod` schemas (`SET search_path TO $ENV, public;`).
- **Migration Runner (`infra/database/migrate.sh`)**:
  - Executes `infra/database/schema.sql` followed by every `infra/database/migrations/*.sql` file in lexical order.
  - Runs automatically in `.github/workflows/ci.yml` (`dev`) and `.github/workflows/cd.yml` (`prod`) before `terraform apply`, or locally via `./infra/scripts/deploy.sh --env dev --use-local-env --migrate`.

## 2. Idempotent & Backward-Compatible SQL Rules

- **Strictly Idempotent DDL**: Every statement in `schema.sql` and `migrations/*.sql` is re-executed on every deployment. Always use `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `ON CONFLICT DO NOTHING/UPDATE`.
- **Unqualified Table Names**: Never hardcode `dev.` or `prod.` schema prefixes inside migration files so `migrate.sh`'s `search_path` targets the right environment automatically.
- **Zero-Downtime Rollout**: Keep schema changes additive and backward-compatible with currently running Lambdas (`match-api`, `storage-worker`, `chat-api`).
- **Key Constraints**: Preserve the unique constraint `UNIQUE (match_id, inning_number)` on `innings` (relied upon by `match-api`'s idempotent `ON CONFLICT (match_id, inning_number) DO UPDATE` upsert) and `vector(1536)` on `rule_chunks`.
