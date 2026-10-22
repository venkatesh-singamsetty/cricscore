# CricScore Engineering Constitution & Agent Rules

## 1. Mandatory Skill Activation

- **Always Load Matching Skills First**: Before modifying code, infrastructure, tests, deploying, or opening/updating a Pull Request—including immediately after conversation context compaction—you **MUST** call `view_file` on the relevant `.agents/skills/*/SKILL.md` file(s) and follow their checklists:
  - PRs, Git & CI/CD: `cricscore-pr-and-workflow`
  - Dependabot PR Consolidation (Collaborator-Only): `cricscore-dependabot-consolidation`
  - Infrastructure & Local/Prod Deployments: `cricscore-infrastructure-standards`
  - Code Review & Quality: `cricscore-code-review-standards`
  - Testing (Unit, Component, ML, E2E): `cricscore-testing-standards`
  - Security & Scanners: `cricscore-security-standards`
  - Cloud Cost Governance: `cricscore-cost-governance`
  - Frontend (React, Live Score, DLS): `cricscore-frontend-architecture`
  - Backend (Lambdas, WebSockets, Postgres): `cricscore-backend-architecture`
  - MLOps (XGBoost, Win Probability DP+DLS, Docker): `cricscore-mlops-standards`
  - Agentic AI, RAG & MCP (`apps/ai-service` & `chat-api`): `cricscore-agentic-rag-architecture`
  - Database Schema & Migrations: `cricscore-database-migrations`

## 2. Foolproof Local Deployment Rules (`.env.local`)

- **Always pass `--use-local-env` to `deploy.sh`**:
  - Pre-flight check: `./infra/scripts/deploy.sh --env dev --use-local-env --check`
  - Deploy to `dev`: `./infra/scripts/deploy.sh --env dev --use-local-env` (add `--migrate` if DB migrations changed)
  - Deploy to `prod` (only when requested after `dev` is verified): `./infra/scripts/deploy.sh --env prod --use-local-env`
- **Never mix `dev` and `prod` state or `.env` files**:
  - `deploy.sh` reconfigures `infra/terraform/.terraform` to `cricscore/<env>/terraform.tfstate` and overwrites `apps/frontend/.env` with that environment's URLs (`cricscoredev` vs `cricscore`). Never run manual `npm run build` + `aws s3 sync` without verifying `apps/frontend/.env` matches the target environment, and never commit `apps/frontend/.env`.
- **Keep AWS Provider `!= 6.69.0`**: Because `deploy.sh` runs `terraform init -reconfigure -upgrade`, always keep `version = "~> 6.0, != 6.69.0"` in `infra/terraform/providers.tf` so Lambda updates never fail with `bufio.Scanner: token too long`.

## 3. Git, Pull Request & CI/CD Workflow

- **Always pull `main` & create a fresh branch for every new feature or bug fix**: Before writing any code for a new task, run `git checkout main && git pull origin main && git checkout -b <feat|fix>/<descriptive-name>`. Never push directly to `main` and never reuse an already-merged PR branch.
- **Consolidate open Dependabot PRs into the new working branch (Collaborator-Only)**: Whenever creating a new working branch, check for open PRs authored strictly by `app/dependabot` (`./infra/scripts/consolidate_dependabot_prs.sh --merge`), validate and fix any issues locally, push the branch to `origin`, and close the superseded Dependabot PRs (`./infra/scripts/consolidate_dependabot_prs.sh --close --target-pr <PR>`) ONLY after verifying collaborator permission (`admin`/`maintain`/`write`) and confirming the commits are on `origin/<branch>`.
- **Always sync with `origin/main` before pushing**: Run `git fetch origin main && git merge origin/main` before pushing or opening/updating a PR so the branch is never out-of-date with `main`.
- **Validation & Pre-Push Workflow (Zero-Duplicate)**: Always commit changes first (`git commit`) before pushing. You can either push directly with `git push` (allowing `.husky/pre-push` to run `./infra/scripts/validate_local.sh --fast` once automatically) or run `./infra/scripts/validate_local.sh --fast` after committing (which stamps `.git/.local_validation_receipt` so `git push` skips in <0.1s). Avoid validating uncommitted code right before committing, as updating `HEAD` invalidates the receipt and causes duplicate runs. Never use GitHub Actions for trial-and-error debugging.
- **Post-PR Check & CodeQL Resolution**: After pushing or opening a PR, inspect GitHub Actions status (`gh pr checks`) and inline review/CodeQL comments (`gh api repos/venkatesh-singamsetty/cricscore/pulls/<PR>/comments`) and resolve any findings immediately.

## 4. Testing & Documentation Completeness

- **Tests with every change**: Every feature or bug fix must include unit/component tests (`apps/frontend/src/test/`, `apps/backend/lambdas/`, `apps/ml-engine/test_predict.py`). If UI labels, buttons, or flows in `MatchSetup`, `MatchView`, or `App` change, update and run Playwright E2E (`apps/e2e`) against `dev` so CI never hangs or fails.
- **Documentation with every change**: Always update `docs/testing.md` and relevant architecture tutorials (`docs/mlops_tutorial.md`, `docs/websocket_tutorial.md`, `docs/deployment.md`) in the same PR. Do not manually prepend entries to `docs/changelog.md` on feature branches, as `semantic-release` automatically generates `docs/changelog.md` on `main` and manual edits cause merge conflicts.

## 5. Cloud Cost, Security & Code Hygiene

- **Strictly forbidden paid AWS resources**: Never create NAT Gateways (~$32/mo), KMS Customer-Managed Keys ($1/mo), CloudWatch Dashboards ($3/mo), AWS Secrets Manager ($0.40/mo), or DynamoDB Provisioned Capacity.
- **Bounded compute, logs & DB pooling**: Keep Lambda timeouts bounded (10–15s max; 30s max for `chat-api`), CloudWatch log retention capped at 7 days (`retention_in_days = 7`), and reuse `pg.Pool` across warm Lambda invocations.
- **Zero secret leaks & CodeQL clean**: Never commit, print, or expose `.env.local`, API keys, DB URLs, or binary caches (`__pycache__/`, `*.pyc`, `venv/`). Remove unused variables/imports and enforce strictly read-only AI chat, parameterized SQL queries with single-statement SELECT validation guards, SHA-256 model checksum verification, and server-side Cognito/role authorization.
