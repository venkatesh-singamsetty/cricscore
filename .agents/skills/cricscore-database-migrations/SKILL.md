---
name: cricscore-database-migrations
description: Use when changing PostgreSQL schemas, SQL migrations, indexes, seed data, or deploying database changes to CricScore dev or prod.
---

# CricScore Database Migration Standards

## Environment and execution model

- CricScore uses Aiven PostgreSQL with separate `dev` and `prod` schemas. The deployment workflows run `infra/database/migrate.sh` for the target environment before applying application infrastructure.
- The migration script loads `schema.sql` and then executes every `infra/database/migrations/*.sql` file on each deployment. Write migrations to be safely repeatable, as the existing migrations generally use `IF NOT EXISTS`.
- The script sets `search_path` to the selected environment and `public`; verify whether SQL uses unqualified objects or explicitly names `dev`/`prod` before changing it.

## Safe schema evolution

- Preserve compatibility with currently deployed Lambdas and frontend clients during rollout. Prefer additive, backward-compatible changes; split destructive or contract-breaking changes across releases.
- Assess locking, table size, index build behavior, data backfills, constraints, and rollback/recovery before choosing a migration. `IF NOT EXISTS` alone does not make a migration safe or semantically correct.
- Never run production migrations, destructive SQL, or data rewrites without explicit user authorization and a clear target environment. Do not include database credentials in commands, logs, or generated artifacts.
- Test the migration against a disposable or local database where available. Verify both clean application and repeat application, then test the code that reads/writes the changed schema.

## References

- Migration runner: `infra/database/migrate.sh`
- Base schema: `infra/database/schema.sql`
- Deployment ordering: `.github/workflows/ci.yml` and `.github/workflows/cd.yml`
