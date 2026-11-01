# 🛠️ CricScore Developer & Operations Cheatsheet

Quick-reference command tutorial for setting up, developing, testing, deploying, and debugging CricScore. Run commands from the repository root unless noted.

- **[1. Initial Setup & Infrastructure](#1-initial-setup--infrastructure)** — Install prerequisites, authenticate AWS & GitHub CLI, and initialize `.env.local`.
- **[2. Git Workflow & PR Management](#2-git-workflow--pr-management)** — Feature branching, Dependabot consolidation, pre-push validation, and PR checks.
- **[3. Node.js & Monorepo Scripts](#3-nodejs--project-scripts-monorepo-root)** — Local Vite dev server, production bundle build, ESLint, Prettier, and dependency audits.
- **[4. Testing & Validation (376 Unit + 15 E2E)](#4-testing--validation)** — Vitest (`151` FE + `121` BE), Pytest (`75` AI + `29` ML), and Playwright E2E suites.
- **[5. MLOps & Win Prediction Training](#5-mlops--machine-learning-local-training)** — Cricsheet extraction, 8-model MLflow benchmark (`compare_models.py`), and `~309 MB` CPU Docker build.
- **[6. Pre-Push Security & DevSecOps Scans](#6-pre-push-security--code-scanning-local)** — `npm audit`, GitLeaks, Trivy, Checkov IaC, and Syft SPDX SBOM generation.
- **[7. Full Cloud Deployment (`dev` & `prod`)](#7-full-cloud-deployment)** — `deploy.sh --use-local-env`, `--model-version` rollbacks, and `terraform.sh` wrapper.
- **[8. AWS CLI Troubleshooting](#8-aws-troubleshooting-expert-cli-commands)** — Tail Lambda logs, inspect SQS FIFO, DynamoDB, single-image ECR, and Terraform state.
- **[9. PostgreSQL (`psql`) Troubleshooting](#9-database-postgresql-troubleshooting)** — Inspect `dev`/`prod` schemas, query matches, deterministic POTM, and pool activity.

---

## 1. Initial Setup & Infrastructure

- **Step 1.1 (Authenticate GitHub CLI):** `gh auth login`
- **Step 1.2 (Clone Repository):** `git clone https://github.com/venkatesh-singamsetty/cricscore.git && cd cricscore`
- **Step 1.3 (Install Prerequisites — Node 24, Python 3.12, Terraform 1.10, AWS CLI, Scanners):** `./infra/scripts/setup.sh`
- **Step 1.4 (Configure AWS Credentials):** `aws configure`
- **Step 1.5 (Initialize Local Env Files):** `cp .env.local.example .env.local && cp apps/frontend/.env.example apps/frontend/.env`
- **Step 1.6 (Sync GitHub Environment Secrets & Variables):** `./infra/scripts/setup_github_envs.sh`

```bash
gh auth login
git clone https://github.com/venkatesh-singamsetty/cricscore.git && cd cricscore
./infra/scripts/setup.sh
aws configure
cp .env.local.example .env.local
cp apps/frontend/.env.example apps/frontend/.env
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
# 1. Sync main and create a feature branch
git checkout main && git pull origin main
git checkout -b feat/your-feature-name

# 2. Optional: Consolidate open Dependabot PRs into your branch
./infra/scripts/consolidate_dependabot_prs.sh --merge

# 3. Stage, commit (Conventional Commits), and sync with origin/main
git add .
git commit -m "feat: your descriptive commit message"
git fetch origin main && git merge origin/main --no-edit

# 4. Push branch (automatically runs fast pre-push validation hook)
git push -u origin HEAD

# 5. Open Pull Request and monitor status checks + CodeQL comments
gh pr create --title "feat: added new feature" --body "Detailed summary" --base main
gh pr checks
gh api repos/venkatesh-singamsetty/cricscore/pulls/<PR_NUMBER>/comments

# 6. Close superseded Dependabot PRs (if consolidated in step 2)
./infra/scripts/consolidate_dependabot_prs.sh --close --target-pr <PR_NUMBER>

# 7. Once all required CI & CodeQL status checks pass, review and merge the PR on GitHub
gh pr checks
```

---

## 3. Node.js & Project Scripts (Monorepo Root)

- **`npm install` (Monorepo + Workspaces):** Installs all workspace dependencies.
- **`npm run dev` (`apps/frontend`):** Starts Vite React 19 dev server on `http://localhost:5173`.
- **`npm run build` (`apps/frontend`):** Runs `tsc -b && vite build` production bundle check.
- **`npm run lint` (`apps/frontend`):** Runs ESLint + TypeScript strict type checking.
- **`npm run deps:check` (All Workspaces + Lambdas + Python):** Audits outdated packages before Dependabot opens PRs.

```bash
npm install
npm run dev
npm run build
npm run lint
npx prettier --write "apps/**/*.{ts,tsx,js,jsx,json,md}"
npm run deps:check
```

---

## 4. Testing & Validation

CricScore maintains **376 automated unit/integration tests** (`151` Frontend + `121` Backend + `75` AI Service + `29` ML Engine) plus **15 Playwright E2E tests**:

| Suite                        | Tests | Command                                 |
| :--------------------------- | :---: | :-------------------------------------- |
| **Frontend Vitest**          | `151` | `npm run test`                          |
| **Backend Vitest**           | `121` | `npm test --prefix apps/backend`        |
| **All JS/TS Unit (FE + BE)** | `272` | `npm run test:all`                      |
| **Python AI Pytest**         | `75`  | `pytest apps/ai-service -q`             |
| **Python ML Pytest**         | `29`  | `pytest apps/ml-engine/test_predict.py` |
| **Playwright E2E (Dev)**     | `15`  | `npm run test:e2e:dev`                  |
| **Multi-Browser Live Sync**  | `E2E` | `npm run test:e2e:sync:headed`          |
| **Live AI Chat MCP Eval**    | `MCP` | `npm run test:ai`                       |

```bash
# Run all Frontend + Backend Vitest suites (272 tests)
npm run test:all

# Run Python AI Service (75 tests) + ML Engine (29 tests)
pytest apps/ai-service apps/ml-engine/test_predict.py -q

# Run Playwright E2E suites against Dev
npx playwright install --with-deps
npm run test:e2e:dev
npm run test:e2e:dev:headed
npm run test:e2e:sync:headed
npm run test:e2e:journey:headed
```

---

## 5. MLOps & Machine Learning (Local Training)

- **1. Extract Cricsheet Data (`python data_pipeline.py`):** Extracts `786K+` deliveries into `apps/ml-engine/data/live_data.csv`.
- **2. 8-Model Benchmark & MLflow (`python compare_models.py v2.2.0`):** Produces `live_win_predictor_model.joblib` (`XGBoost v2.2.0`), `model_manifest.json`, and `comparison_report.md`.
- **3. DVC Pipeline Reproduction (`dvc repro`):** Verifies `dvc.yaml` stages and updates `dvc.lock` hashes.
- **4. CPU Container Build (`docker build ...`):** Builds the `~309 MB` `xgboost-cpu` Lambda container image.

```bash
cd apps/ml-engine
python3 -m venv .venv-train && source .venv-train/bin/activate
pip install -r requirements-train.txt

# Extract dataset & run 8-model MLflow benchmark
python data_pipeline.py
python compare_models.py v2.2.0

# Run ML inference unit tests (29 tests)
pytest test_predict.py -v

# Build CPU-optimized Lambda container (~309 MB)
docker build --platform linux/amd64 --provenance=false -t cricscore-ml-predict:v2.2.0 .
```

---

## 6. Pre-Push Security & Code Scanning (Local)

| Scanner       | Target            | Command                                            |
| :------------ | :---------------- | :------------------------------------------------- |
| **Full Gate** | All Checks        | `./infra/scripts/validate_local.sh --skip-e2e`     |
| **npm audit** | Node Dependencies | `npm audit`                                        |
| **GitLeaks**  | Secret Detection  | `gitleaks detect -v`                               |
| **Trivy**     | Lockfile CVEs     | `trivy fs ./package-lock.json`                     |
| **Checkov**   | Terraform IaC     | `checkov -d infra/terraform/`                      |
| **Syft**      | SPDX SBOM         | `syft dir:. -o spdx-json=cricscore-sbom.spdx.json` |

---

## 7. Full Cloud Deployment

Always pass `--use-local-env` to `deploy.sh` when deploying from your workstation:

```bash
# Pre-flight check (validates AWS credentials, Docker daemon, and .env.local)
./infra/scripts/deploy.sh --env dev --use-local-env --check

# Deploy full stack to Dev (add --migrate if DB schema changed)
./infra/scripts/deploy.sh --env dev --use-local-env

# Deploy full stack to Prod (after verifying Dev)
./infra/scripts/deploy.sh --env prod --use-local-env

# Deploy or Rollback a specific ML model version in S3 & ECR
./infra/scripts/deploy.sh --env dev --use-local-env --model-version v2.2.0
./infra/scripts/deploy.sh --env prod --use-local-env --model-version v2.2.0

# Terraform helper wrapper (loads .env.local automatically)
./infra/scripts/terraform.sh fmt -check -recursive
./infra/scripts/terraform.sh validate
./infra/scripts/terraform.sh plan
```

---

## 8. AWS Troubleshooting (Expert CLI Commands)

- **Tail Score Update Lambda Logs:**
  `aws logs tail /aws/lambda/cricscoredev-score-upd --follow --format short`
- **Tail AI Chat / Summary Logs:**
  `aws logs tail /aws/lambda/cricscoredev-chat-api --follow`
- **Tail Match API Logs:**
  `aws logs tail /aws/lambda/cricscoredev-match-api --follow`
- **Check Active WebSocket Connections:**
  `aws dynamodb scan --table-name cricscoredev-connections --select COUNT`
- **Check SQS FIFO Queue Backlog:**
  `aws sqs get-queue-attributes --queue-url https://sqs.us-east-1.amazonaws.com/<ACCOUNT_ID>/cricscoredev-storage-buffer.fifo --attribute-names ApproximateNumberOfMessages`
- **Inspect Single Retained ECR Image (`~309 MB`):**
  `aws ecr describe-images --repository-name cricscoredev-ml-predict --query 'imageDetails[*].[imageTags[0],imageSizeInBytes]' --output table`
- **Unlock Stuck Terraform State via GitHub Actions:**
  `gh workflow run terraform-unlock.yml -f environment=dev -f lock_id=<LOCK_ID>`
- **Trigger Nightly Terraform Drift Check:**
  `gh workflow run drift.yml`

---

## 9. Database (PostgreSQL) Troubleshooting

```bash
# Connect to Aiven PostgreSQL using TF_DATABASE_URL from .env.local
psql "postgres://username:password@hostname:port/defaultdb?sslmode=require"
```

- **List Database Schemas (`dev`, `prod`):** `\dn`
- **Switch Active Session Schema:** `SET search_path TO dev;`
- **List All Tables (`matches`, `innings`, `players`, `bowlers`, `balls`, `tournament_rules`):** `\dt`
- **Inspect Latest Matches & Deterministic POTM Awards:**
  `SELECT id, status, match_winner, player_of_the_match FROM matches ORDER BY created_at DESC LIMIT 5;`
- **Inspect Recent Ball-by-Ball Records:**
  `SELECT * FROM balls ORDER BY id DESC LIMIT 10;`
- **Check Active Connection Pool Usage:**
  `SELECT count(*), state FROM pg_stat_activity GROUP BY state;`
