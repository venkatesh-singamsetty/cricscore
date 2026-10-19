# CricScore Engineering Constitution & Agent Rules

## 1. Mandatory Skill Activation

- **Always Load Matching Skills First**: Before modifying code, infrastructure, tests, or opening/updating a Pull Request—including immediately after conversation context compaction—you **MUST** call `view_file` on the relevant `.agents/skills/*/SKILL.md` file(s) and follow their domain checklists.
  - PRs, Git & CI/CD: `cricscore-pr-and-workflow`
  - Code Review & Quality: `cricscore-code-review-standards`
  - Testing (Unit, Component, ML, E2E): `cricscore-testing-standards`
  - Security & Scanners: `cricscore-security-standards`
  - Cloud Cost Governance: `cricscore-cost-governance`
  - Frontend (React, Live Score, DLS): `cricscore-frontend-architecture`
  - Backend (Lambdas, WebSockets, Postgres): `cricscore-backend-architecture`
  - MLOps (Win Probability DP+DLS, Docker): `cricscore-mlops-standards`
  - Agentic RAG & MCP (`chat-api`): `cricscore-agentic-rag-architecture`
  - Infrastructure & Terraform: `cricscore-infrastructure-standards`
  - Database Schema & Migrations: `cricscore-database-migrations`

## 2. Git, Pull Request & Deployment Workflow

- **Never push directly to `main`**: Always work on a `feat/*` or `fix/*` branch and open a Pull Request.
- **Always sync with `origin/main` before pushing**: Run `git fetch origin main && git merge origin/main` before pushing or opening/updating a PR so the branch is never out-of-date with `main`.
- **Validate locally before pushing**: Always run `./infra/scripts/validate_local.sh` (and `./apps/ml-engine/venv/bin/pytest apps/ml-engine/test_predict.py` for ML changes) locally before pushing. Never use GitHub Actions for trial-and-error debugging.
- **Deploy & verify on `dev` before `prod`**: Always deploy local changes to `dev` (`./infra/scripts/deploy.sh --env dev --use-local-env`) and verify end-to-end before deploying to `prod`.
- **Post-PR Check & CodeQL Resolution**: After pushing or opening a PR, inspect GitHub Actions status (`gh pr checks`) and inline review/CodeQL comments (`gh api repos/venkatesh-singamsetty/cricscore/pulls/<PR>/comments`) and resolve any findings immediately.

## 3. Testing & Documentation Completeness

- **Tests with every change**: Every feature or bug fix must include unit/component tests (`apps/frontend/src/test/`, `apps/backend/lambdas/`, `apps/ml-engine/test_predict.py`). If UI labels, buttons, or flows in `MatchSetup`, `MatchView`, or `App` change, update and run Playwright E2E (`apps/e2e`) against `dev` so CI never hangs or fails.
- **Documentation with every change**: Always update `docs/changelog.md`, `docs/testing.md`, and relevant architecture tutorials (`docs/mlops_tutorial.md`, `docs/websocket_tutorial.md`, `docs/deployment.md`) in the same PR.

## 4. Cloud Cost & Infrastructure Governance

- **Strictly forbidden paid AWS resources**: Never create NAT Gateways (~$32/mo), KMS Customer-Managed Keys ($1/mo), CloudWatch Dashboards ($3/mo), AWS Secrets Manager ($0.40/mo), or DynamoDB Provisioned Capacity.
- **Bounded compute & logs**: Keep Lambda timeouts bounded (10–15s max; 30s max for `chat-api`) and CloudWatch log retention capped at 7 days (`retention_in_days = 7`).
- **Configuration & DB pooling**: Use SSM Parameter Store (Standard free tier) for non-sensitive config and always reuse `pg.Pool` across warm Lambda invocations to prevent Aiven PostgreSQL connection exhaustion.

## 5. Security & Code Hygiene

- **Zero secret or artifact leaks**: Never commit, print, or expose `.env.local`, API keys, DB URLs, or binary caches (`__pycache__/`, `*.pyc`, `venv/`).
- **Zero unused code / CodeQL clean**: Remove unused variables, imports, and dead code before committing. Enforce parameterized SQL queries and server-side Cognito JWT / role authorization on all write/admin endpoints.
