# 🛠️ CricScore Developer & Operations Cheatsheet

Quick-reference command tutorial for setting up, developing, testing, deploying, and debugging CricScore. Run commands from the repository root unless noted.

| #     | Section                                                                          | Primary Use Case                                                                                       |
| :---- | :------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| **1** | [Initial Setup & Infrastructure](#1-initial-setup--infrastructure)               | • Install prerequisites<br/>• Authenticate AWS & GitHub CLI<br/>• Initialize `.env.local`              |
| **2** | [Git Workflow & PR Management](#2-git-workflow--pr-management)                   | • Feature branching<br/>• Dependabot consolidation<br/>• Pre-push validation & PR status checks        |
| **3** | [Node.js & Monorepo Scripts](#3-nodejs--project-scripts-monorepo-root)           | • Local Vite server<br/>• Production bundle build & ESLint<br/>• Prettier & dependency audits          |
| **4** | [Testing & Validation (376 Unit + E2E)](#4-testing--validation)                  | • Vitest (`151` FE + `121` BE)<br/>• Pytest (`75` AI + `29` ML)<br/>• Playwright E2E suites            |
| **5** | [MLOps & Win Prediction Training](#5-mlops--machine-learning-local-training)     | • Cricsheet extraction<br/>• 8-model MLflow benchmark (`compare_models.py`)<br/>• Docker `~309 MB` CPU |
| **6** | [Pre-Push Security & DevSecOps Scans](#6-pre-push-security--code-scanning-local) | • `npm audit` & GitLeaks<br/>• Trivy & Checkov IaC<br/>• Syft SPDX SBOM generation                     |
| **7** | [Full Cloud Deployment (`dev` & `prod`)](#7-full-cloud-deployment)               | • `deploy.sh --use-local-env`<br/>• Model version rollbacks<br/>• `terraform.sh` wrapper               |
| **8** | [AWS CLI Troubleshooting](#8-aws-troubleshooting-expert-cli-commands)            | • Tail Lambda logs<br/>• Inspect SQS FIFO, DynamoDB & single-image ECR<br/>• Unlock Terraform state    |
| **9** | [PostgreSQL (`psql`) Troubleshooting](#9-database-postgresql-troubleshooting)    | • Inspect `dev` / `prod` schemas<br/>• Query matches, deterministic POTM & balls<br/>• Pool activity   |

---

## 1. Initial Setup & Infrastructure

| Step    | Action                                                                          | Command                                                                                |
| :------ | :------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------- |
| **1.1** | Authenticate GitHub CLI                                                         | `gh auth login`                                                                        |
| **1.2** | Clone repository                                                                | `git clone https://github.com/venkatesh-singamsetty/cricscore.git && cd cricscore`     |
| **1.3** | Install prerequisites (Node 24, Python 3.12, Terraform 1.10, AWS CLI, scanners) | `./infra/scripts/setup.sh`                                                             |
| **1.4** | Configure AWS credentials                                                       | `aws configure`                                                                        |
| **1.5** | Initialize local environment files                                              | `cp .env.local.example .env.local && cp apps/frontend/.env.example apps/frontend/.env` |
| **1.6** | Sync GitHub Environment secrets & variables (`dev` & `prod`)                    | `./infra/scripts/setup_github_envs.sh`                                                 |

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
flowchart LR
    A["git checkout -b feat/..."] --> B["./infra/scripts/validate_local.sh --skip-e2e"]
    B --> C["./infra/scripts/deploy.sh --env dev --use-local-env"]
    C --> D["git push -u origin HEAD"]
    D --> E["gh pr create & CI Status Checks"]
    E --> F["Squash & Merge to main -> Auto Prod Release"]
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

| Script               | Scope                             | What It Does                                               |
| :------------------- | :-------------------------------- | :--------------------------------------------------------- |
| `npm install`        | Monorepo + Workspaces             | Installs all workspace dependencies                        |
| `npm run dev`        | `apps/frontend`                   | Starts Vite React 19 dev server on `http://localhost:5173` |
| `npm run build`      | `apps/frontend`                   | Runs `tsc -b && vite build` production bundle check        |
| `npm run lint`       | `apps/frontend`                   | Runs ESLint + TypeScript strict type checking              |
| `npm run deps:check` | All Workspaces + Lambdas + Python | Audits outdated packages before Dependabot opens PRs       |

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

CricScore maintains **376 automated unit/integration tests** (`151` Frontend + `121` Backend + `75` AI Service + `29` ML Engine) plus **Playwright** E2E suites:

| Suite                                  |   Test Count    | Command                                                                     |
| :------------------------------------- | :-------------: | :-------------------------------------------------------------------------- |
| **Frontend Unit & Component (Vitest)** |      `151`      | `npm run test`                                                              |
| **Backend Lambda Unit (Vitest)**       |      `121`      | `npm test --prefix apps/backend`                                            |
| **All JS/TS Unit Tests (FE + BE)**     |      `272`      | `npm run test:all`                                                          |
| **Python AI Service Unit (Pytest)**    |      `75`       | `./apps/ml-engine/.venv-train/bin/pytest apps/ai-service -q`                |
| **Python ML Engine Unit (Pytest)**     |      `29`       | `./apps/ml-engine/.venv-train/bin/pytest apps/ml-engine/test_predict.py -q` |
| **Playwright E2E (Dev Cloud)**         |  Cross-Browser  | `npm run test:e2e:dev`                                                      |
| **Playwright Multi-Browser Live Sync** | Scorer + Viewer | `npm run test:e2e:sync:headed`                                              |
| **Live AI Chat MCP Evaluation**        |    4 Agents     | `npm run test:ai`                                                           |

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

| Stage                             | Script / File                     | Output Artifact                                                                                     |
| :-------------------------------- | :-------------------------------- | :-------------------------------------------------------------------------------------------------- |
| **1. Extract Cricsheet Data**     | `python data_pipeline.py`         | `apps/ml-engine/data/live_data.csv` (`786K+` deliveries)                                            |
| **2. 8-Model Benchmark & MLflow** | `python compare_models.py v2.2.0` | `live_win_predictor_model.joblib` (`XGBoost v2.2.0`), `model_manifest.json`, `comparison_report.md` |
| **3. DVC Pipeline Reproduction**  | `dvc repro`                       | Verifies `dvc.yaml` & updates `dvc.lock` hashes                                                     |
| **4. CPU Container Build**        | `docker build ...`                | `~309 MB` `xgboost-cpu` Lambda container image                                                      |

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

| Scanner                                    | Target                     | Command                                            |
| :----------------------------------------- | :------------------------- | :------------------------------------------------- |
| **Full Local Gate (All Scanners + Tests)** | Entire Repo                | `./infra/scripts/validate_local.sh --skip-e2e`     |
| **npm audit**                              | Node.js Dependencies       | `npm audit`                                        |
| **GitLeaks**                               | Secret Detection           | `gitleaks detect -v`                               |
| **Trivy**                                  | Filesystem & Lockfile CVEs | `trivy fs ./package-lock.json`                     |
| **Checkov**                                | Terraform IaC Security     | `checkov -d infra/terraform/`                      |
| **Syft**                                   | SPDX SBOM Generation       | `syft dir:. -o spdx-json=cricscore-sbom.spdx.json` |

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

| Task                                                | AWS CLI Command                                                                                                                                                            |
| :-------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tail Score Update Lambda Logs**                   | `aws logs tail /aws/lambda/cricscoredev-score-upd --follow --format short`                                                                                                 |
| **Tail AI Chat / Summary Logs**                     | `aws logs tail /aws/lambda/cricscoredev-chat-api --follow`                                                                                                                 |
| **Tail Match API Logs**                             | `aws logs tail /aws/lambda/cricscoredev-match-api --follow`                                                                                                                |
| **Check Active WebSocket Connections**              | `aws dynamodb scan --table-name cricscoredev-connections --select COUNT`                                                                                                   |
| **Check SQS FIFO Queue Backlog**                    | `aws sqs get-queue-attributes --queue-url https://sqs.us-east-1.amazonaws.com/<ACCOUNT_ID>/cricscoredev-storage-buffer.fifo --attribute-names ApproximateNumberOfMessages` |
| **Inspect Single Retained ECR Image (`~309 MB`)**   | `aws ecr describe-images --repository-name cricscoredev-ml-predict --query 'imageDetails[*].[imageTags[0],imageSizeInBytes]' --output table`                               |
| **Unlock Stuck Terraform State via GitHub Actions** | `gh workflow run terraform-unlock.yml -f environment=dev -f lock_id=<LOCK_ID>`                                                                                             |
| **Trigger Nightly Terraform Drift Check**           | `gh workflow run drift.yml`                                                                                                                                                |

---

## 9. Database (PostgreSQL) Troubleshooting

```bash
# Connect to Aiven PostgreSQL using TF_DATABASE_URL from .env.local
psql "postgres://username:password@hostname:port/defaultdb?sslmode=require"
```

| SQL / `psql` Command                                                                                  | Purpose                                                                                   |
| :---------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------- |
| `\dn`                                                                                                 | List database schemas (`dev`, `prod`)                                                     |
| `SET search_path TO dev;`                                                                             | Switch active session to `dev` (or `prod`) schema                                         |
| `\dt`                                                                                                 | List all tables (`matches`, `innings`, `players`, `bowlers`, `balls`, `tournament_rules`) |
| `SELECT id, status, match_winner, player_of_the_match FROM matches ORDER BY created_at DESC LIMIT 5;` | Inspect latest matches and deterministic POTM awards                                      |
| `SELECT * FROM balls ORDER BY id DESC LIMIT 10;`                                                      | Inspect most recent ball-by-ball persistence records                                      |
| `SELECT count(*), state FROM pg_stat_activity GROUP BY state;`                                        | Check active connection pool usage across Lambdas                                         |
