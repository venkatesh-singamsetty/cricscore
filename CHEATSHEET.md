# 🛠️ CricScore Developer & Operations Cheatsheet

Quick-reference command tutorial for setting up, developing, testing, deploying, and debugging CricScore. Run commands from the repository root unless noted.

- **[1. Initial Setup & Prerequisites](#1-initial-setup--prerequisites)** — Install prerequisites, authenticate AWS & GitHub CLI, and initialize `.env.local`.
- **[2. Git Workflow & PR Management](#2-git-workflow--pr-management)** — Feature branching, Dependabot consolidation, pre-push validation, and PR checks.
- **[3. Node.js & Monorepo Scripts](#3-nodejs--project-scripts-monorepo-root)** — Local Vite dev server, production bundle build, ESLint, Prettier, and dependency audits.
- **[4. Testing & Validation Suites](#4-testing--validation-suites)** — Vitest (`151` FE + `121` BE), Pytest (`75` AI + `29` ML), and Playwright E2E suites.
- **[5. MLOps & Win Prediction Training](#5-mlops--machine-learning-local-training)** — Cricsheet extraction, 8-model MLflow benchmark (`compare_models.py`), and `~309 MB` CPU Docker build.
- **[6. Pre-Push Security & DevSecOps Scans](#6-pre-push-security--code-scanning-local)** — `npm audit`, GitLeaks, Trivy, Checkov IaC, and Syft SPDX SBOM generation.
- **[7. Full Cloud Deployment (`dev` & `prod`)](#7-full-cloud-deployment)** — `deploy.sh --use-local-env`, `--model-version` rollbacks, and `terraform.sh` wrapper.
- **[8. AWS CLI Troubleshooting](#8-aws-troubleshooting-expert-cli-commands)** — Tail Lambda logs, inspect SQS FIFO, DynamoDB, single-image ECR, and Terraform state.
- **[9. Database (PostgreSQL) Troubleshooting](#9-database-postgresql-troubleshooting)** — Inspect `dev`/`prod` schemas, query matches, deterministic POTM, and pool activity.

---

## 1. Initial Setup & Prerequisites

```bash
# 1. Authenticate with GitHub CLI
gh auth login

# 2. Clone the CricScore repository and enter project directory
git clone https://github.com/venkatesh-singamsetty/cricscore.git && cd cricscore

# 3. Install prerequisites (Node 24, Python 3.12, Terraform 1.10, AWS CLI, DevSecOps scanners)
./infra/scripts/setup.sh

# 4. Configure AWS CLI credentials and default region (us-east-1)
aws configure

# 5. Initialize local environment variable files for root and frontend
cp .env.local.example .env.local
cp apps/frontend/.env.example apps/frontend/.env

# 6. Synchronize required GitHub repository secrets and environment variables
./infra/scripts/setup_github_envs.sh

```

---

## 2. Git Workflow & PR Management

Direct pushes to `main` are blocked by branch protection. Always use a feature branch and Pull Request:

```mermaid
flowchart TD
    A["1. git checkout -b feat/..."] --> B["2. ./infra/scripts/validate_local.sh --skip-e2e"]
    B --> C["3. ./infra/scripts/deploy.sh --env dev --use-local-env"]
    C --> D["4. git push -u origin HEAD"]
    D --> E["5. gh pr create & CI Status Checks"]
    E --> F["6. Squash & Merge to main -> Auto Prod Release"]
```

```bash
# 1. Synchronize main branch and create an isolated feature branch
git checkout main && git pull origin main
git checkout -b feat/your-feature-name

# 2. Optional: Consolidate and merge open Dependabot PRs into your feature branch
./infra/scripts/consolidate_dependabot_prs.sh --merge

# 3. Stage changes, commit following Conventional Commits, and sync with latest main
git add .
git commit -m "feat: your descriptive commit message"
git fetch origin main && git merge origin/main --no-edit

# 4. Push feature branch to GitHub (automatically runs fast pre-push validation hook)
git push -u origin feat/your-feature-name

# 5. Open Pull Request targeting main and monitor CI status checks
gh pr create --title "feat: added new feature" --body "Detailed summary" --base main

# 6. Check status of running GitHub Actions CI checks on the PR
gh pr checks

# 7. Review any automated inline review comments (CodeQL, Dependabot)
gh api repos/venkatesh-singamsetty/cricscore/pulls/<PR_NUMBER>/comments

# 8. Close superseded Dependabot PRs if consolidated in step 2
./infra/scripts/consolidate_dependabot_prs.sh --close --target-pr <PR_NUMBER>

```

---

## 3. Node.js & Project Scripts (Monorepo Root)

```bash
# Install all dependencies across root, workspaces (frontend, backend), and CDK
npm install

# Start local Vite development server for React 19 frontend (http://localhost:5173)
npm run dev

# Run TypeScript compilation and Vite production bundle build check
npm run build

# Run ESLint and strict TypeScript type check across frontend codebase
npm run lint

# Auto-format codebase using Prettier
npx prettier --write "apps/**/*.{ts,tsx,js,jsx,json,md}"

# Audit outdated dependencies across all npm workspaces, Lambda functions, and Python services
npm run deps:check

```

---

## 4. Testing & Validation Suites

CricScore maintains **376 automated unit/integration tests** (`151` Frontend + `121` Backend + `75` AI Service + `29` ML Engine) plus **15 Playwright E2E tests**:

```bash
# Run all Frontend and Backend Vitest unit test suites (272 tests total)
npm run test:all

# Run Frontend Vitest suite only (151 tests)
npm run test

# Run Backend Vitest suite only (121 tests)
npm test --prefix apps/backend

# Run Python AI Service pytest suite (75 tests)
pytest apps/ai-service -q

# Run Python ML Engine inference pytest suite (29 tests)
pytest apps/ml-engine/test_predict.py -q

# Run all Python test suites together (104 tests)
pytest apps/ai-service apps/ml-engine/test_predict.py -q

# Install Playwright browser binaries with system dependencies
npx playwright install --with-deps

# Run full Playwright E2E suite against Dev environment (15 tests headless)
npm run test:e2e:dev

# Run Playwright E2E tests with headed browser UI
npm run test:e2e:dev:headed

# Run multi-browser real-time WebSocket live sync validation (headed)
npm run test:e2e:sync:headed

# Run end-to-end full match journey test (headed)
npm run test:e2e:journey:headed

# Evaluate live AI chat MCP tools and response generation
npm run test:ai

```

---

## 5. MLOps & Machine Learning (Local Training)

```bash
# Navigate to ML engine directory
cd apps/ml-engine

# Create and activate dedicated Python virtual environment for model training
python3 -m venv .venv-train && source .venv-train/bin/activate

# Install training dependencies (XGBoost, MLflow, Scikit-learn, Pandas, DVC)
pip install -r requirements-train.txt

# Extract Cricsheet ball-by-ball dataset (786K+ deliveries) to data/live_data.csv
python data_pipeline.py

# Run 8-model MLflow benchmark, produce XGBoost model artifact and comparison report
python compare_models.py v2.2.0

# Reproduce DVC pipeline stages and verify stage hashes
dvc repro

# Run ML inference unit tests (29 tests)
pytest test_predict.py -v

# Build CPU-optimized Lambda container image (~309 MB single image)
docker build --platform linux/amd64 --provenance=false -t cricscore-ml-predict:v2.2.0 .

# Return to repository root directory
cd ../..

```

---

## 6. Pre-Push Security & DevSecOps Scans

```bash
# Run complete local validation gate (tests, formatting, lint, and security scanners)
./infra/scripts/validate_local.sh --skip-e2e

# Scan Node.js dependencies for known vulnerabilities and security advisories
npm audit

# Detect hardcoded secrets, tokens, and private keys across repository history
gitleaks detect -v

# Scan project filesystem and lockfile for package vulnerabilities and CVEs
trivy fs ./package-lock.json

# Run static analysis and DevSecOps compliance checks on Terraform IaC configurations
checkov -d infra/terraform/

# Generate an SPDX software bill of materials (SBOM) in JSON format
syft dir:. -o spdx-json=cricscore-sbom.spdx.json

```

---

## 7. Full Cloud Deployment

Always pass `--use-local-env` to `deploy.sh` when deploying from your workstation:

```bash
# Pre-flight check (validates AWS credentials, Docker daemon, and .env.local)
./infra/scripts/deploy.sh --env dev --use-local-env --check

# Deploy full stack to Dev environment (pass --migrate if DB schema changed)
./infra/scripts/deploy.sh --env dev --use-local-env

# Deploy full stack to Prod environment (run only after verifying Dev)
./infra/scripts/deploy.sh --env prod --use-local-env

# Deploy or rollback a specific ML model version in S3 and ECR for Dev
./infra/scripts/deploy.sh --env dev --use-local-env --model-version v2.2.0

# Deploy or rollback a specific ML model version in S3 and ECR for Prod
./infra/scripts/deploy.sh --env prod --use-local-env --model-version v2.2.0

# Format Terraform configuration files recursively
./infra/scripts/terraform.sh fmt -check -recursive

# Validate Terraform IaC syntax and configuration
./infra/scripts/terraform.sh validate

# Preview planned cloud infrastructure changes for active environment
./infra/scripts/terraform.sh plan

```

---

## 8. AWS CLI Troubleshooting

```bash
# Tail live logs for the Score Update Lambda function (Dev)
aws logs tail /aws/lambda/cricscoredev-score-upd --follow --format short

# Tail live logs for the AI Chat and match summary Lambda function (Dev)
aws logs tail /aws/lambda/cricscoredev-chat-api --follow

# Tail live logs for the Match REST API Lambda function (Dev)
aws logs tail /aws/lambda/cricscoredev-match-api --follow

# Check the count of active WebSocket client connections in DynamoDB
aws dynamodb scan --table-name cricscoredev-connections --select COUNT

# Check backlog and approximate number of messages waiting in SQS FIFO storage buffer
aws sqs get-queue-attributes --queue-url https://sqs.us-east-1.amazonaws.com/<ACCOUNT_ID>/cricscoredev-storage-buffer.fifo --attribute-names ApproximateNumberOfMessages

# Inspect single retained ECR container image tag and size (~309 MB CPU image)
aws ecr describe-images --repository-name cricscoredev-ml-predict --query 'imageDetails[*].[imageTags[0],imageSizeInBytes]' --output table

# Unlock stuck Terraform state lock ID via GitHub Actions workflow dispatch
gh workflow run terraform-unlock.yml -f environment=dev -f lock_id=<LOCK_ID>

# Trigger manual cloud infrastructure drift detection workflow
gh workflow run drift.yml

```

---

## 9. Database (PostgreSQL) Troubleshooting

```bash
# Connect to Aiven PostgreSQL using TF_DATABASE_URL from .env.local
psql "postgres://username:password@hostname:port/defaultdb?sslmode=require"

```

Interactive `psql` meta-commands and queries:

```sql
-- List database schemas (dev, prod)
\dn

-- Switch active session schema to development
SET search_path TO dev;

-- List all tables in current schema (matches, innings, players, bowlers, balls, tournament_rules)
\dt

-- Inspect 5 latest matches and deterministic Player of the Match awards
SELECT id, status, match_winner, player_of_the_match FROM matches ORDER BY created_at DESC LIMIT 5;

-- Inspect 10 most recent ball-by-ball delivery records
SELECT * FROM balls ORDER BY id DESC LIMIT 10;

-- Check active PostgreSQL connection pool usage and state distribution
SELECT count(*), state FROM pg_stat_activity GROUP BY state;

```
