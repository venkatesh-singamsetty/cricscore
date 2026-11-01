# 🛠️ CricScore Unified Platform & Artifacts Dashboard

A central single-pane-of-glass directory providing live references across all layers of the CricScore platform: GitHub repository architecture, variables, secrets, actions, build artifacts, serverless infrastructure, container images, machine learning models, database vector schemas, and security reports.

> **Automated Directory**: Active resource inventory for `venkatesh-singamsetty/cricscore` across AWS Account `926789386606` (`us-east-1`) and Aiven Cloud. To refresh, run `./infra/scripts/generate_platform_dashboard.sh`.

---

## 📌 Quick Navigation

- [🐙 GitHub Repository Resources, Actions, Vars & Secrets](#-github-repository-resources-actions-vars--secrets)
- [🟢 Development Environment](#-development-dev)
- [🔵 Production Environment](#-production-prod)
- [🤖 ML Models, Container Images & MLOps Registry](#-ml-models-container-images--mlops-registry)
- [🗄️ Database, Vectors & RAG Architecture](#-database-vectors--rag-architecture-aiven-postgresql)
- [📦 Storage & S3 Buckets](#-storage-s3-buckets--terraform-state)
- [🛡️ Security Posture, SBOM & CI/CD Scans](#-security-posture-sbom--cicd-scans)
- [📊 Observability, Traces & Alarms](#-observability-tracing--alarms-aws-x-ray--cloudwatch)

---

## 🐙 GitHub Repository Resources, Actions, Vars & Secrets

- **GitHub Repository:** [`venkatesh-singamsetty/cricscore`](https://github.com/venkatesh-singamsetty/cricscore)
- **Default Branch:** `main` (Protected; requires PR status checks before merge)
- **GitHub Environments:** [`dev`](https://github.com/venkatesh-singamsetty/cricscore/deployments/activity_log?environment=dev) and [`prod`](https://github.com/venkatesh-singamsetty/cricscore/deployments/activity_log?environment=prod)
- **Releases & Version Tags:** [`GitHub Releases`](https://github.com/venkatesh-singamsetty/cricscore/releases) (Automated semantic versioning via `semantic-release`)

### ⚙️ GitHub Actions Workflow Catalog

- **CI (`ci.yml` — [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml)):** Runs on PRs and pushes to `main`; executes 4 validation suites (`376` unit tests + security gates) and deploys/tests `dev` (`15` Playwright E2E tests) on `main` merge.
- **CD (`cd.yml` — [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/cd.yml)):** Triggered when a `v*` release is published; deploys `prod`, runs `15` Playwright E2E tests, and runs OWASP ZAP DAST.
- **Semantic Release (`release.yml` — [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/release.yml)):** Triggered after CI succeeds on `main`; cuts the next `v*` tag and updates `docs/changelog.md`.
- **CodeQL SAST (`codeql.yml` — [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/codeql.yml)):** Multi-language static security analysis (`javascript-typescript` & `python`) on PRs, `main`, and weekly schedule.
- **Generate SBOM (`sbom.yml` — [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/sbom.yml)):** Generates Syft Software Bill of Materials (`spdx-json` artifact) on pushes to `main` and releases.
- **MLOps Pipeline (`mlops-pipeline.yml` — [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/mlops-pipeline.yml)):** Runs the 8-model benchmark (`compare_models.py`), enforces the XGBoost `v2.2.0` quality gate, and uploads artifacts.
- **ML Model Release & Rollback (`ml-model-release.yml` — [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ml-model-release.yml)):** Manual `workflow_dispatch` to promote or roll back `MODEL_VERSION` across `dev`/`prod` Lambdas.
- **Terraform Drift Detection (`drift.yml` — [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/drift.yml)):** Nightly (`00:00 UTC`) verification of Terraform state against live `dev` and `prod` AWS resources.
- **Database Keep-Alive (`keepalive.yml` — [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/keepalive.yml)):** Scheduled query preventing Aiven PostgreSQL free-tier hibernation.
- **Terraform Force Unlock (`terraform-unlock.yml` — [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/terraform-unlock.yml)):** Emergency manual release of stuck S3 `.tflock` state locks.
- **Dependabot Updates (`dependabot.yml` — [Open Dependabot](https://github.com/venkatesh-singamsetty/cricscore/security/dependabot)):** Weekly security PRs for npm, pip, and GitHub Actions.

### 📋 GitHub Repository Variables (`vars.*`)

| Variable           | Value / Format                       | Scope               |
| ------------------ | ------------------------------------ | ------------------- |
| `AWS_REGION`       | `us-east-1`                          | CI, CD, Workflows   |
| `DOMAIN_NAME`      | `cricscore.venkateshsingamsetty.com` | CI, CD, Terraform   |
| `ZONE_DOMAIN`      | `venkateshsingamsetty.com`           | CI, CD, Terraform   |
| `PROJECT_NAME`     | `cricscore`                          | CI, CD, Terraform   |
| `SUBDOMAIN_PREFIX` | `cricscore`                          | CI, CD, Terraform   |
| `TF_STATE_BUCKET`  | `venky-2026-terraform-state`         | CI, CD, Terraform   |
| `ADMIN_EMAIL`      | Scorer admin email                   | Terraform, Cognito  |
| `LLM_MODEL`        | `gpt-4o-mini`                        | AI Service, Lambdas |
| `LLM_BASE_URL`     | Optional URL                         | AI Service, Lambdas |

### 🔒 GitHub Repository Secrets Inventory (`secrets.*`)

> [!NOTE]
> In compliance with CricScore Security Standards, only secret metadata and purposes are documented here. Secret values are injected directly into GitHub Actions runners and backend Lambda environments, never exposed to clients or checked into source code.

- **`AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY` ([Secrets Console](https://github.com/venkatesh-singamsetty/cricscore/settings/secrets/actions)):** IAM credentials used by GitHub Actions runners for Terraform apply and S3/CloudFront sync.
- **`AWS_ROLE_ARN` ([Secrets Console](https://github.com/venkatesh-singamsetty/cricscore/settings/secrets/actions)):** Optional IAM Role ARN for GitHub Actions OIDC federation.
- **`TF_DATABASE_URL` ([Secrets Console](https://github.com/venkatesh-singamsetty/cricscore/settings/secrets/actions)):** Aiven PostgreSQL connection URI (`postgres://...sslmode=require`), injected solely into backend Lambdas and migration steps.
- **`TF_SES_SOURCE_EMAIL` ([Secrets Console](https://github.com/venkatesh-singamsetty/cricscore/settings/secrets/actions)):** Verified Amazon SES sender email for post-match HTML scorecard reports.
- **`OPENAI_API_KEY` ([Secrets Console](https://github.com/venkatesh-singamsetty/cricscore/settings/secrets/actions)):** API key for the OpenAI `gpt-4o-mini` conversational assistant (bounded to 600 max tokens/turn).
- **`GH_PAT` / `GITHUB_TOKEN` (Managed by GitHub):** Workflow token with `contents: write` to publish releases, tags, and GitHub issues.

### 📦 GitHub Pipeline & Build Artifacts

- **Software Bill of Materials (SPDX JSON):** Downloadable `spdx-json` artifact in [`Generate SBOM`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/sbom.yml).
- **CodeQL SAST SARIF Reports:** Published under [`Security → Code scanning`](https://github.com/venkatesh-singamsetty/cricscore/security/code-scanning).
- **Trivy & GitLeaks Security Logs:** Logged on every PR and push in [`ci.yml`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml).
- **Playwright E2E HTML Reports:** `playwright-report-dev` and `playwright-report-prod` workflow artifacts.
- **Semantic Release Changelog:** [`docs/changelog.md`](./changelog.md) and [`GitHub Releases`](https://github.com/venkatesh-singamsetty/cricscore/releases).

---

## 🟢 Development (DEV)

### 🌐 Core Endpoints, Identity & Storage

- **Frontend Web App:** [`https://cricscoredev.venkateshsingamsetty.com`](https://cricscoredev.venkateshsingamsetty.com)
- **CloudFront CDN Distribution (`E1K3FWDNEXFSL0`):** [CloudFront Console](https://us-east-1.console.aws.amazon.com/cloudfront/v4/home?region=us-east-1#/distributions/E1K3FWDNEXFSL0)
- **HTTP API Gateway (`sx6hhs0yj6`):** `https://api.cricscoredev.venkateshsingamsetty.com` — [HTTP API Console](https://us-east-1.console.aws.amazon.com/apigateway/main/apis/sx6hhs0yj6/routes?region=us-east-1)
- **WebSocket API Gateway (`ql2tnw8ls6`):** `wss://ws.cricscoredev.venkateshsingamsetty.com` — [WebSocket API Console](https://us-east-1.console.aws.amazon.com/apigateway/main/apis/ql2tnw8ls6/routes?region=us-east-1)
- **Route 53 & ACM TLS (`cricscoredev.venkateshsingamsetty.com`):** [Route 53 Console](https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones) · [ACM Console](https://us-east-1.console.aws.amazon.com/acm/home?region=us-east-1#/certificates)
- **Cognito User Pool (`us-east-1_InxzxljX7`):** Client `1n4m9rm96nhkd1vnqpnfsr1eg9`, Domain `cricscoredev-auth-dev` — [Cognito Users & Groups](https://us-east-1.console.aws.amazon.com/cognito/v2/idp/user-pools/us-east-1_InxzxljX7/users?region=us-east-1)
- **S3 Static Web Bucket (`7d` noncurrent lifecycle):** `s3://cricscoredev-app-e8d6bb50c5656dc8a2271c54a0` — [Open S3 Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-app-e8d6bb50c5656dc8a2271c54a0?region=us-east-1)
- **S3 Match Backups & ML Registry (`180d` lifecycle):** `s3://cricscoredev-match-backups-937fe838a46144fff5facd682f` — [Open S3 Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-match-backups-937fe838a46144fff5facd682f?region=us-east-1)
- **S3 Access Logs Bucket (`30d` lifecycle):** `s3://cricscoredev-app-logs-a6dc993b498342c8e5800d409e` — [Open S3 Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-app-logs-a6dc993b498342c8e5800d409e?region=us-east-1)
- **DynamoDB WS Connections (`PAY_PER_REQUEST`):** `cricscoredev-connections` — [DynamoDB Explorer](https://us-east-1.console.aws.amazon.com/dynamodbv2/home?region=us-east-1#item-explorer?table=cricscoredev-connections)
- **SQS FIFO Storage Queue:** `cricscoredev-storage-buffer.fifo` — [SQS Queue Console](https://us-east-1.console.aws.amazon.com/sqs/v3/home?region=us-east-1#/queues/https%3A%2F%2Fsqs.us-east-1.amazonaws.com%2F926789386606%2Fcricscoredev-storage-buffer.fifo)
- **SNS Match Events & Alerts Topics:** [`cricscoredev-match-events`](https://us-east-1.console.aws.amazon.com/sns/v3/home?region=us-east-1#/topic/arn:aws:sns:us-east-1:926789386606:cricscoredev-match-events) · [`cricscoredev-lambda-alerts`](https://us-east-1.console.aws.amazon.com/sns/v3/home?region=us-east-1#/topic/arn:aws:sns:us-east-1:926789386606:cricscoredev-lambda-alerts)
- **ECR ML Container Repo (`countNumber=1`):** `cricscoredev-ml-predict` (`294.75 MB`, pushed `2026-10-31 22:39:31`) — [ECR Repo Console](https://us-east-1.console.aws.amazon.com/ecr/repositories/private/926789386606/cricscoredev-ml-predict?region=us-east-1)

### ⚡ Serverless Compute & Telemetry (AWS Lambda)

- **`broadcaster` (`Node.js 24.x`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-broadcaster) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-broadcaster)
- **`chat-api` (`Node.js 24.x`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-chat-api) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-chat-api)
- **`cognito-presignup` (`Node.js 24.x`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-cognito-presignup) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-cognito-presignup)
- **`match-api` (`Node.js 24.x`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-match-api) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-match-api)
- **`ml-predict` (`Docker (Python 3.12, xgboost-cpu)`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-ml-predict) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-ml-predict)
- **`onconnect` (`Node.js 24.x`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-onconnect) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-onconnect)
- **`ondisconnect` (`Node.js 24.x`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-ondisconnect) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-ondisconnect)
- **`score-upd` (`Node.js 24.x`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-score-upd) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-score-upd)
- **`storage-worker` (`Node.js 24.x`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-storage-worker) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-storage-worker)

---

## 🔵 Production (PROD)

### 🌐 Core Endpoints, Identity & Storage

- **Frontend Web App:** [`https://cricscore.venkateshsingamsetty.com`](https://cricscore.venkateshsingamsetty.com)
- **CloudFront CDN Distribution (`E3FVVHMKMZ5G5O`):** [CloudFront Console](https://us-east-1.console.aws.amazon.com/cloudfront/v4/home?region=us-east-1#/distributions/E3FVVHMKMZ5G5O)
- **HTTP API Gateway (`ispht71fh0`):** `https://api.cricscore.venkateshsingamsetty.com` — [HTTP API Console](https://us-east-1.console.aws.amazon.com/apigateway/main/apis/ispht71fh0/routes?region=us-east-1)
- **WebSocket API Gateway (`to0pkago8j`):** `wss://ws.cricscore.venkateshsingamsetty.com` — [WebSocket API Console](https://us-east-1.console.aws.amazon.com/apigateway/main/apis/to0pkago8j/routes?region=us-east-1)
- **Route 53 & ACM TLS (`cricscore.venkateshsingamsetty.com`):** [Route 53 Console](https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones) · [ACM Console](https://us-east-1.console.aws.amazon.com/acm/home?region=us-east-1#/certificates)
- **Cognito User Pool (`us-east-1_7OssmfCnh`):** Client `5gn0fv3ha5m7t7ah66quuavhv5`, Domain `cricscore-auth-prod` — [Cognito Users & Groups](https://us-east-1.console.aws.amazon.com/cognito/v2/idp/user-pools/us-east-1_7OssmfCnh/users?region=us-east-1)
- **S3 Static Web Bucket (`7d` noncurrent lifecycle):** `s3://cricscore-app-7e93ca64fca840e1639f6fbd71` — [Open S3 Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscore-app-7e93ca64fca840e1639f6fbd71?region=us-east-1)
- **S3 Match Backups & ML Registry (`180d` lifecycle):** `s3://cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d` — [Open S3 Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d?region=us-east-1)
- **S3 Access Logs Bucket (`30d` lifecycle):** `s3://cricscore-app-logs-b123ba8b0aa118a0a9fee8bbc2` — [Open S3 Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscore-app-logs-b123ba8b0aa118a0a9fee8bbc2?region=us-east-1)
- **DynamoDB WS Connections (`PAY_PER_REQUEST`):** `cricscore-connections` — [DynamoDB Explorer](https://us-east-1.console.aws.amazon.com/dynamodbv2/home?region=us-east-1#item-explorer?table=cricscore-connections)
- **SQS FIFO Storage Queue:** `cricscore-storage-buffer.fifo` — [SQS Queue Console](https://us-east-1.console.aws.amazon.com/sqs/v3/home?region=us-east-1#/queues/https%3A%2F%2Fsqs.us-east-1.amazonaws.com%2F926789386606%2Fcricscore-storage-buffer.fifo)
- **SNS Match Events & Alerts Topics:** [`cricscore-match-events`](https://us-east-1.console.aws.amazon.com/sns/v3/home?region=us-east-1#/topic/arn:aws:sns:us-east-1:926789386606:cricscore-match-events) · [`cricscore-lambda-alerts`](https://us-east-1.console.aws.amazon.com/sns/v3/home?region=us-east-1#/topic/arn:aws:sns:us-east-1:926789386606:cricscore-lambda-alerts)
- **ECR ML Container Repo (`countNumber=1`):** `cricscore-ml-predict` (`294.75 MB`, pushed `2026-10-31 23:23:23`) — [ECR Repo Console](https://us-east-1.console.aws.amazon.com/ecr/repositories/private/926789386606/cricscore-ml-predict?region=us-east-1)

### ⚡ Serverless Compute & Telemetry (AWS Lambda)

- **`broadcaster` (`Node.js 24.x`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-broadcaster) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-broadcaster)
- **`chat-api` (`Node.js 24.x`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-chat-api) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-chat-api)
- **`cognito-presignup` (`Node.js 24.x`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-cognito-presignup) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-cognito-presignup)
- **`match-api` (`Node.js 24.x`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-match-api) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-match-api)
- **`ml-predict` (`Docker (Python 3.12, xgboost-cpu)`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-ml-predict) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-ml-predict)
- **`onconnect` (`Node.js 24.x`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-onconnect) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-onconnect)
- **`ondisconnect` (`Node.js 24.x`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-ondisconnect) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-ondisconnect)
- **`score-upd` (`Node.js 24.x`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-score-upd) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-score-upd)
- **`storage-worker` (`Node.js 24.x`):** [Function Console](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-storage-worker) · [CloudWatch Logs (7d)](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-storage-worker)

---

## 🤖 ML Models, Container Images & MLOps Registry

### Active Champion Model Architecture

- **Champion Version & Algorithm:** `v2.2.0` (`XGBoost`)
- **S3 Model Registry (Dev):** `s3://cricscoredev-match-backups-937fe838a46144fff5facd682f/models/v2.2.0/live_win_predictor_model.joblib` ([S3 Console](https://us-east-1.console.aws.amazon.com/s3/buckets/cricscoredev-match-backups-937fe838a46144fff5facd682f?region=us-east-1&prefix=models/v2.2.0/))
- **S3 Model Registry (Prod):** `s3://cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d/models/v2.2.0/live_win_predictor_model.joblib` ([S3 Console](https://us-east-1.console.aws.amazon.com/s3/buckets/cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d?region=us-east-1&prefix=models/v2.2.0/))
- **Local Model & Manifest:** [`live_win_predictor_model.joblib`](../apps/ml-engine/live_win_predictor_model.joblib) · [`model_manifest.json`](../apps/ml-engine/model_manifest.json) · [`live_metadata.json`](../apps/ml-engine/live_metadata.json)
- **SHA-256 Checksum:** `de9e39513fbac895df7c86c449ef0a6b687717b5d1f40af08b5a5b13aa37c0cf`
- **DVC Dataset Lineage:** `dvc:31e19c47bdbc05d773938754d8589516` (`cricket-data/t20s_json.zip.dvc`, `dvc.yaml`, `dvc.lock`)
- **ECR Container Optimization:** `public.ecr.aws/lambda/python:3.12` + `xgboost-cpu` (`~309 MB`, `countNumber = 1` single-image retention)
- **Dev ECR Image (`:v2.2.0`):** `294.75 MB` · Digest `sha256:c1723ea5521349d856a0246704689110d6e70ea99d02d6dfaac2aa15a342f0b0` · Pushed `2026-10-31 22:39:31`
- **Prod ECR Image (`:v2.2.0`):** `294.75 MB` · Digest `sha256:f51eafbe8b57d802746c067068c953f58892721272b5ca09fbf8daa92b552632` · Pushed `2026-10-31 23:23:23`

### Champion vs. Baseline Benchmark Metrics

| Metric            | XGBoost (`v2.2.0`) | Logistic (`v1.0.0`) | Delta          |
| ----------------- | ------------------ | ------------------- | -------------- |
| **Val Log Loss**  | **`0.5786`**       | `0.8069`            | **-28.3%**     |
| **Test Log Loss** | **`0.6018`**       | —                   | **Stable**     |
| **Val Accuracy**  | **`68.35%`**       | `65.59%`            | **+2.76%**     |
| **Test Accuracy** | **`69.01%`**       | —                   | **Consistent** |
| **Val ROC-AUC**   | **`0.7723`**       | `0.755`             | **+0.0173**    |
| **Test ROC-AUC**  | **`0.7529`**       | —                   | **Strong**     |
| **Brier Score**   | **`0.1992`**       | `0.2379`            | **-16.3%**     |

---

## 🗄️ Database, Vectors & RAG Architecture (Aiven PostgreSQL)

- **Managed PostgreSQL 16:** Host `cricscore-db-venky-cric-score.b.aivencloud.com`, Port `17727`, Database `defaultdb` ([Aiven Console](https://console.aiven.io/))
- **Schema Isolation & TLS:** Isolated `dev` and `prod` schemas (`SET search_path`) over `sslmode=require` (`pg.Pool` max 5 connections)
- **Core Relational Tables:** `matches` (includes `ai_summary`, `player_of_the_match`), `innings`, `players`, `bowlers`, `balls`
- **Vector RAG Table (`pgvector`):** `tournament_rules` (`vector(1536)` embeddings + HNSW cosine index `vector_cosine_ops`)
- **Database Migrations:** [`infra/database/schema.sql`](../infra/database/schema.sql) and [`infra/database/migrations/`](../infra/database/migrations/)
- **4 MCP Specialist Tools:** `execute_sql` (Match Stats), `search_tournament_rules` (`pgvector` RAG), `get_match_weather` (Open-Meteo), and `create_github_issue` (GitHub API)
- **AI Documentation:** [`ai_architecture.md`](./ai_architecture.md) · [`weather_report_agent.md`](./weather_report_agent.md) · [`github_issue_agent.md`](./github_issue_agent.md)

---

## 📦 Storage, S3 Buckets & Terraform State

- **Static Web Hosting (DEV):** [`cricscoredev-app-e8d6bb50c5656dc8a2271c54a0`](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-app-e8d6bb50c5656dc8a2271c54a0?region=us-east-1)
- **Static Web Hosting (PROD):** [`cricscore-app-7e93ca64fca840e1639f6fbd71`](https://s3.console.aws.amazon.com/s3/buckets/cricscore-app-7e93ca64fca840e1639f6fbd71?region=us-east-1)
- **Match Event Backups & ML Registry (DEV):** [`cricscoredev-match-backups-937fe838a46144fff5facd682f`](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-match-backups-937fe838a46144fff5facd682f?region=us-east-1)
- **Match Event Backups & ML Registry (PROD):** [`cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d`](https://s3.console.aws.amazon.com/s3/buckets/cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d?region=us-east-1)
- **CloudFront CDN Logs (DEV):** [`cricscoredev-app-logs-a6dc993b498342c8e5800d409e`](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-app-logs-a6dc993b498342c8e5800d409e?region=us-east-1)
- **CloudFront CDN Logs (PROD):** [`cricscore-app-logs-b123ba8b0aa118a0a9fee8bbc2`](https://s3.console.aws.amazon.com/s3/buckets/cricscore-app-logs-b123ba8b0aa118a0a9fee8bbc2?region=us-east-1)
- **Terraform Remote State (GLOBAL):** [`venky-2026-terraform-state`](https://s3.console.aws.amazon.com/s3/buckets/venky-2026-terraform-state?region=us-east-1)
  - **Dev State Key:** `s3://venky-2026-terraform-state/cricscore/dev/terraform.tfstate`
  - **Prod State Key:** `s3://venky-2026-terraform-state/cricscore/prod/terraform.tfstate`

---

## 🛡️ Security Posture, SBOM & CI/CD Scans

- **CodeQL SAST:** JavaScript, TypeScript & Python static analysis ([Code Scanning Console](https://github.com/venkatesh-singamsetty/cricscore/security/code-scanning))
- **Dependabot SCA:** Automated npm, pip & GitHub Actions dependency updates ([Dependabot Alerts](https://github.com/venkatesh-singamsetty/cricscore/security/dependabot))
- **GitLeaks & Trivy:** Secret detection and HIGH/CRITICAL CVE scans on every PR ([`ci.yml`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml))
- **Checkov IaC:** Terraform security & compliance checks ([`ci.yml`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml))
- **Syft SPDX SBOM:** Software Bill of Materials `spdx-json` artifact ([`sbom.yml`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/sbom.yml))
- **OWASP ZAP (DAST):** Live baseline dynamic security scan on `dev` & `prod` ([`ci.yml`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml) · [`cd.yml`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/cd.yml))

---

## 📊 Observability, Tracing & Alarms (AWS X-Ray & CloudWatch)

- **CloudWatch Log Groups (7-day retention):** [Open Log Groups](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups)
- **CloudWatch Metrics (API Gateway, Lambda, SQS FIFO):** [Open Metrics](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#metricsV2)
- **AWS X-Ray Service Map (5% sampling, `1 req/s` reservoir):** [Open Service Map](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:service-map/map)
- **AWS X-Ray Traces (Waterfall Latency Analysis):** [Open X-Ray Traces](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:traces/query)
- **CloudWatch Alarms (`match-api` & `score-upd` SNS Email Alerts):** [Open Alarms](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#alarmsV2:)
