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

| Property                    | Value / Link                                                                                                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub Repository**       | [`venkatesh-singamsetty/cricscore`](https://github.com/venkatesh-singamsetty/cricscore)                                                                                                                         |
| **Default Branch**          | `main` (Protected; requires PR status checks before merge)                                                                                                                                                      |
| **GitHub Environments**     | [`dev`](https://github.com/venkatesh-singamsetty/cricscore/deployments/activity_log?environment=dev) and [`prod`](https://github.com/venkatesh-singamsetty/cricscore/deployments/activity_log?environment=prod) |
| **Releases & Version Tags** | [`GitHub Releases`](https://github.com/venkatesh-singamsetty/cricscore/releases) (Automated semantic versioning via `semantic-release`)                                                                         |

### ⚙️ GitHub Actions Workflow Catalog

| Workflow Name                      | File                                     | Trigger Events                                       | Primary Responsibilities                                                                                 | Direct Console Link                                                                                        |
| ---------------------------------- | ---------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **CI (Continuous Integration)**    | `.github/workflows/ci.yml`               | Pull requests, push to `main`                        | 4 validation suites (Security, Frontend, Backend, Python AI/ML); deploys and tests `dev` on `main` merge | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml)               |
| **CD (Continuous Delivery)**       | `.github/workflows/cd.yml`               | Release published (`v*`)                             | Production deployment, Playwright E2E against Prod, OWASP ZAP baseline scan                              | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/cd.yml)               |
| **Semantic Release**               | `.github/workflows/release.yml`          | CI success on `main`                                 | Analyzes conventional commits, cuts next `v*` tag, publishes release notes & updates changelog           | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/release.yml)          |
| **CodeQL SAST Analysis**           | `.github/workflows/codeql.yml`           | PRs, push to `main`, weekly schedule                 | Multi-language static application security testing (JS/TS & Python)                                      | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/codeql.yml)           |
| **Generate SBOM**                  | `.github/workflows/sbom.yml`             | Push to `main`, release                              | Generates Syft Software Bill of Materials in SPDX JSON format (`spdx-json` artifact)                     | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/sbom.yml)             |
| **MLOps Pipeline (Win Predictor)** | `.github/workflows/mlops-pipeline.yml`   | Dataset or training script changes, monthly schedule | 8-model benchmark evaluation (`compare_models.py`), XGBoost champion quality gate, artifact upload       | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/mlops-pipeline.yml)   |
| **ML Model Release & Rollback**    | `.github/workflows/ml-model-release.yml` | Manual `workflow_dispatch`                           | Promotes or rolls back `MODEL_VERSION` on `dev`/`prod` Lambda and runs live smoke test                   | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ml-model-release.yml) |
| **Terraform Drift Detection**      | `.github/workflows/drift.yml`            | Daily schedule (`00:00 UTC`)                         | Verifies Terraform state synchronization with AWS resources across `dev` and `prod`                      | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/drift.yml)            |
| **Database Keep-Alive**            | `.github/workflows/keepalive.yml`        | Scheduled                                            | Sends keep-alive query to prevent Aiven PostgreSQL free-tier service hibernation                         | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/keepalive.yml)        |
| **Terraform Force Unlock**         | `.github/workflows/terraform-unlock.yml` | Manual `workflow_dispatch`                           | Emergency administrative release of stuck S3 backend `.tflock` locks                                     | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/terraform-unlock.yml) |
| **Dependabot Updates**             | `.github/dependabot.yml`                 | Weekly schedule                                      | Automated security PRs for npm, pip, and GitHub Actions dependencies                                     | [Open Dependabot](https://github.com/venkatesh-singamsetty/cricscore/security/dependabot)                  |

### 📋 GitHub Repository Variables (`vars.*`)

| Variable Name      | Expected Value / Format              | Injection Scope     | Description                                                          |
| ------------------ | ------------------------------------ | ------------------- | -------------------------------------------------------------------- |
| `AWS_REGION`       | `us-east-1`                          | CI, CD, Workflows   | Target AWS deployment region (defaults to `us-east-1`)               |
| `DOMAIN_NAME`      | `cricscore.venkateshsingamsetty.com` | CI, CD, Terraform   | Production primary domain name                                       |
| `ZONE_DOMAIN`      | `venkateshsingamsetty.com`           | CI, CD, Terraform   | Route 53 apex hosted zone domain                                     |
| `PROJECT_NAME`     | `cricscore`                          | CI, CD, Terraform   | Root project prefix for AWS resources (`cricscoredev` / `cricscore`) |
| `SUBDOMAIN_PREFIX` | `cricscore`                          | CI, CD, Terraform   | Subdomain prefix for custom domains                                  |
| `TF_STATE_BUCKET`  | `venky-2026-terraform-state`         | CI, CD, Terraform   | Global S3 bucket storing remote Terraform state                      |
| `ADMIN_EMAIL`      | Scorer admin email                   | Terraform, Cognito  | Root administrator email pre-assigned to the Admin group             |
| `LLM_MODEL`        | `gpt-4o-mini`                        | AI Service, Lambdas | Model identifier used for cricket chat assistant                     |
| `LLM_BASE_URL`     | Optional URL                         | AI Service, Lambdas | Custom endpoint override for OpenAI-compatible providers             |

### 🔒 GitHub Repository Secrets Inventory (`secrets.*`)

> [!NOTE]
> In compliance with CricScore Security Standards, only secret metadata and purposes are documented here. Secret values are injected directly into GitHub Actions runners and backend Lambda environments, never exposed to clients or checked into source code.

| Secret Identifier         | Consumed By           | Purpose & Security Isolation                                                                             | Presence & Verification                                                                               |
| ------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `AWS_ACCESS_KEY_ID`       | CI, CD, Drift Check   | IAM access key used by GitHub Actions runners for Terraform apply and S3/CloudFront sync.                | [GitHub Secrets Console](https://github.com/venkatesh-singamsetty/cricscore/settings/secrets/actions) |
| `AWS_SECRET_ACCESS_KEY`   | CI, CD, Drift Check   | IAM secret access key paired with `AWS_ACCESS_KEY_ID`.                                                   | [GitHub Secrets Console](https://github.com/venkatesh-singamsetty/cricscore/settings/secrets/actions) |
| `AWS_ROLE_ARN`            | CI, CD (Optional)     | IAM Role ARN for GitHub Actions OIDC federation (eliminates long-lived access keys).                     | [GitHub Secrets Console](https://github.com/venkatesh-singamsetty/cricscore/settings/secrets/actions) |
| `TF_DATABASE_URL`         | CI (Migrate), Lambdas | Aiven PostgreSQL connection URI (`postgres://...sslmode=require`). Injected solely into backend Lambdas. | [GitHub Secrets Console](https://github.com/venkatesh-singamsetty/cricscore/settings/secrets/actions) |
| `TF_SES_SOURCE_EMAIL`     | Terraform, Match API  | Verified sender email for post-match score report delivery.                                              | [GitHub Secrets Console](https://github.com/venkatesh-singamsetty/cricscore/settings/secrets/actions) |
| `OPENAI_API_KEY`          | Chat API, AI Service  | API key for OpenAI `gpt-4o-mini` conversational assistant. Bounded to 600 max tokens/turn.               | [GitHub Secrets Console](https://github.com/venkatesh-singamsetty/cricscore/settings/secrets/actions) |
| `GH_PAT` / `GITHUB_TOKEN` | Semantic Release      | GitHub Personal Access Token or workflow token with `contents: write` to publish releases and Git tags.  | Managed by GitHub                                                                                     |

### 📦 GitHub Pipeline & Build Artifacts

| Artifact                                   | Source Workflow     | Location / Link                                                                                                                       |
| ------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Software Bill of Materials (SPDX JSON)** | `sbom.yml`          | Downloadable artifact `spdx-json` in [`Generate SBOM`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/sbom.yml) |
| **CodeQL SAST SARIF Reports**              | `codeql.yml`        | [`Security → Code scanning`](https://github.com/venkatesh-singamsetty/cricscore/security/code-scanning)                               |
| **Trivy & GitLeaks Security Logs**         | `ci.yml`            | Logged on every PR and push in [`ci.yml`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml)                |
| **Playwright E2E HTML Reports**            | `ci.yml` / `cd.yml` | `playwright-report-dev` and `playwright-report-prod` artifacts                                                                        |
| **Semantic Release Changelog**             | `release.yml`       | [`docs/changelog.md`](./changelog.md) and [`GitHub Releases`](https://github.com/venkatesh-singamsetty/cricscore/releases)            |

---

## 🟢 Development (DEV)

### 🌐 Core Endpoints, Identity & Storage

| Resource                           | Identifier / Endpoint                                                                         | AWS Console / Direct Link                                                                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend Web App**               | `https://cricscoredev.venkateshsingamsetty.com`                                               | [Open Web App](https://cricscoredev.venkateshsingamsetty.com)                                                                                                                                  |
| **CloudFront CDN Distribution**    | `E1K3FWDNEXFSL0`                                                                              | [CloudFront Console](https://us-east-1.console.aws.amazon.com/cloudfront/v4/home?region=us-east-1#/distributions/E1K3FWDNEXFSL0)                                                               |
| **HTTP API Gateway**               | `https://api.cricscoredev.venkateshsingamsetty.com` (`sx6hhs0yj6`)                            | [HTTP API Console](https://us-east-1.console.aws.amazon.com/apigateway/main/apis/sx6hhs0yj6/routes?region=us-east-1)                                                                           |
| **WebSocket API Gateway**          | `wss://ws.cricscoredev.venkateshsingamsetty.com` (`ql2tnw8ls6`)                               | [WebSocket API Console](https://us-east-1.console.aws.amazon.com/apigateway/main/apis/ql2tnw8ls6/routes?region=us-east-1)                                                                      |
| **Route 53 & ACM TLS**             | `cricscoredev.venkateshsingamsetty.com`                                                       | [Route 53](https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones) · [ACM Console](https://us-east-1.console.aws.amazon.com/acm/home?region=us-east-1#/certificates)                  |
| **Cognito User Pool**              | `us-east-1_InxzxljX7` (Client: `1n4m9rm96nhkd1vnqpnfsr1eg9`, Domain: `cricscoredev-auth-dev`) | [Cognito Users & Groups](https://us-east-1.console.aws.amazon.com/cognito/v2/idp/user-pools/us-east-1_InxzxljX7/users?region=us-east-1)                                                        |
| **S3 Static Web Bucket**           | `s3://cricscoredev-app-e8d6bb50c5656dc8a2271c54a0` (7d noncurrent lifecycle)                  | [Open S3 Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-app-e8d6bb50c5656dc8a2271c54a0?region=us-east-1)                                                                    |
| **S3 Match Backups & ML Registry** | `s3://cricscoredev-match-backups-937fe838a46144fff5facd682f` (180d backup lifecycle)          | [Open S3 Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-match-backups-937fe838a46144fff5facd682f?region=us-east-1)                                                          |
| **S3 Access Logs Bucket**          | `s3://cricscoredev-app-logs-a6dc993b498342c8e5800d409e` (30d log lifecycle)                   | [Open S3 Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-app-logs-a6dc993b498342c8e5800d409e?region=us-east-1)                                                               |
| **DynamoDB WS Connections**        | `cricscoredev-connections` (`PAY_PER_REQUEST`)                                                | [DynamoDB Explorer](https://us-east-1.console.aws.amazon.com/dynamodbv2/home?region=us-east-1#item-explorer?table=cricscoredev-connections)                                                    |
| **SQS FIFO Storage Queue**         | `cricscoredev-storage-buffer.fifo`                                                            | [SQS Queue Console](https://us-east-1.console.aws.amazon.com/sqs/v3/home?region=us-east-1#/queues/https%3A%2F%2Fsqs.us-east-1.amazonaws.com%2F926789386606%2Fcricscoredev-storage-buffer.fifo) |
| **SNS Match Events Topic**         | `cricscoredev-match-events`                                                                   | [SNS Events Topic](https://us-east-1.console.aws.amazon.com/sns/v3/home?region=us-east-1#/topic/arn:aws:sns:us-east-1:926789386606:cricscoredev-match-events)                                  |
| **SNS Lambda Alerts Topic**        | `cricscoredev-lambda-alerts`                                                                  | [SNS Alerts Topic](https://us-east-1.console.aws.amazon.com/sns/v3/home?region=us-east-1#/topic/arn:aws:sns:us-east-1:926789386606:cricscoredev-lambda-alerts)                                 |
| **ECR ML Container Repo**          | `cricscoredev-ml-predict` (`294.75 MB`, `countNumber=1`, pushed `2026-10-31 21:11:25`)        | [ECR Repo Console](https://us-east-1.console.aws.amazon.com/ecr/repositories/private/926789386606/cricscoredev-ml-predict?region=us-east-1)                                                    |

### ⚡ Serverless Compute & Telemetry (AWS Lambda)

| Lambda Function         | Runtime                             | Function Console                                                                                                                 | CloudWatch Logs (7-Day Retention)                                                                                                                                         |
| ----------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`broadcaster`**       | `Node.js 24.x`                      | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-broadcaster)       | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-broadcaster)       |
| **`chat-api`**          | `Node.js 24.x`                      | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-chat-api)          | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-chat-api)          |
| **`cognito-presignup`** | `Node.js 24.x`                      | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-cognito-presignup) | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-cognito-presignup) |
| **`match-api`**         | `Node.js 24.x`                      | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-match-api)         | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-match-api)         |
| **`ml-predict`**        | `Docker (Python 3.12, xgboost-cpu)` | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-ml-predict)        | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-ml-predict)        |
| **`onconnect`**         | `Node.js 24.x`                      | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-onconnect)         | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-onconnect)         |
| **`ondisconnect`**      | `Node.js 24.x`                      | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-ondisconnect)      | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-ondisconnect)      |
| **`score-upd`**         | `Node.js 24.x`                      | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-score-upd)         | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-score-upd)         |
| **`storage-worker`**    | `Node.js 24.x`                      | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-storage-worker)    | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-storage-worker)    |

---

## 🔵 Production (PROD)

### 🌐 Core Endpoints, Identity & Storage

| Resource                           | Identifier / Endpoint                                                                       | AWS Console / Direct Link                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend Web App**               | `https://cricscore.venkateshsingamsetty.com`                                                | [Open Web App](https://cricscore.venkateshsingamsetty.com)                                                                                                                                  |
| **CloudFront CDN Distribution**    | `E3FVVHMKMZ5G5O`                                                                            | [CloudFront Console](https://us-east-1.console.aws.amazon.com/cloudfront/v4/home?region=us-east-1#/distributions/E3FVVHMKMZ5G5O)                                                            |
| **HTTP API Gateway**               | `https://api.cricscore.venkateshsingamsetty.com` (`ispht71fh0`)                             | [HTTP API Console](https://us-east-1.console.aws.amazon.com/apigateway/main/apis/ispht71fh0/routes?region=us-east-1)                                                                        |
| **WebSocket API Gateway**          | `wss://ws.cricscore.venkateshsingamsetty.com` (`to0pkago8j`)                                | [WebSocket API Console](https://us-east-1.console.aws.amazon.com/apigateway/main/apis/to0pkago8j/routes?region=us-east-1)                                                                   |
| **Route 53 & ACM TLS**             | `cricscore.venkateshsingamsetty.com`                                                        | [Route 53](https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones) · [ACM Console](https://us-east-1.console.aws.amazon.com/acm/home?region=us-east-1#/certificates)               |
| **Cognito User Pool**              | `us-east-1_7OssmfCnh` (Client: `5gn0fv3ha5m7t7ah66quuavhv5`, Domain: `cricscore-auth-prod`) | [Cognito Users & Groups](https://us-east-1.console.aws.amazon.com/cognito/v2/idp/user-pools/us-east-1_7OssmfCnh/users?region=us-east-1)                                                     |
| **S3 Static Web Bucket**           | `s3://cricscore-app-7e93ca64fca840e1639f6fbd71` (7d noncurrent lifecycle)                   | [Open S3 Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscore-app-7e93ca64fca840e1639f6fbd71?region=us-east-1)                                                                    |
| **S3 Match Backups & ML Registry** | `s3://cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d` (180d backup lifecycle)           | [Open S3 Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d?region=us-east-1)                                                          |
| **S3 Access Logs Bucket**          | `s3://cricscore-app-logs-b123ba8b0aa118a0a9fee8bbc2` (30d log lifecycle)                    | [Open S3 Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscore-app-logs-b123ba8b0aa118a0a9fee8bbc2?region=us-east-1)                                                               |
| **DynamoDB WS Connections**        | `cricscore-connections` (`PAY_PER_REQUEST`)                                                 | [DynamoDB Explorer](https://us-east-1.console.aws.amazon.com/dynamodbv2/home?region=us-east-1#item-explorer?table=cricscore-connections)                                                    |
| **SQS FIFO Storage Queue**         | `cricscore-storage-buffer.fifo`                                                             | [SQS Queue Console](https://us-east-1.console.aws.amazon.com/sqs/v3/home?region=us-east-1#/queues/https%3A%2F%2Fsqs.us-east-1.amazonaws.com%2F926789386606%2Fcricscore-storage-buffer.fifo) |
| **SNS Match Events Topic**         | `cricscore-match-events`                                                                    | [SNS Events Topic](https://us-east-1.console.aws.amazon.com/sns/v3/home?region=us-east-1#/topic/arn:aws:sns:us-east-1:926789386606:cricscore-match-events)                                  |
| **SNS Lambda Alerts Topic**        | `cricscore-lambda-alerts`                                                                   | [SNS Alerts Topic](https://us-east-1.console.aws.amazon.com/sns/v3/home?region=us-east-1#/topic/arn:aws:sns:us-east-1:926789386606:cricscore-lambda-alerts)                                 |
| **ECR ML Container Repo**          | `cricscore-ml-predict` (`652.12 MB`, `countNumber=1`, pushed `2026-10-22 12:40:17`)         | [ECR Repo Console](https://us-east-1.console.aws.amazon.com/ecr/repositories/private/926789386606/cricscore-ml-predict?region=us-east-1)                                                    |

### ⚡ Serverless Compute & Telemetry (AWS Lambda)

| Lambda Function         | Runtime                             | Function Console                                                                                                              | CloudWatch Logs (7-Day Retention)                                                                                                                                      |
| ----------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`broadcaster`**       | `Node.js 24.x`                      | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-broadcaster)       | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-broadcaster)       |
| **`chat-api`**          | `Node.js 24.x`                      | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-chat-api)          | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-chat-api)          |
| **`cognito-presignup`** | `Node.js 24.x`                      | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-cognito-presignup) | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-cognito-presignup) |
| **`match-api`**         | `Node.js 24.x`                      | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-match-api)         | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-match-api)         |
| **`ml-predict`**        | `Docker (Python 3.12, xgboost-cpu)` | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-ml-predict)        | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-ml-predict)        |
| **`onconnect`**         | `Node.js 24.x`                      | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-onconnect)         | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-onconnect)         |
| **`ondisconnect`**      | `Node.js 24.x`                      | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-ondisconnect)      | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-ondisconnect)      |
| **`score-upd`**         | `Node.js 24.x`                      | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-score-upd)         | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-score-upd)         |
| **`storage-worker`**    | `Node.js 24.x`                      | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-storage-worker)    | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-storage-worker)    |

---

## 🤖 ML Models, Container Images & MLOps Registry

### Active Champion Model Architecture

| Artifact / Property              | Value / Location                                                                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Champion Version & Algorithm** | `v2.2.0` (`XGBoost`)                                                                                                                                                                                                                                                        |
| **S3 Model Registry (Dev)**      | `s3://cricscoredev-match-backups-937fe838a46144fff5facd682f/models/v2.2.0/live_win_predictor_model.joblib` ([S3 Console](https://us-east-1.console.aws.amazon.com/s3/buckets/cricscoredev-match-backups-937fe838a46144fff5facd682f?region=us-east-1&prefix=models/v2.2.0/)) |
| **S3 Model Registry (Prod)**     | `s3://cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d/models/v2.2.0/live_win_predictor_model.joblib` ([S3 Console](https://us-east-1.console.aws.amazon.com/s3/buckets/cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d?region=us-east-1&prefix=models/v2.2.0/))       |
| **Local Model & Manifest**       | [`apps/ml-engine/live_win_predictor_model.joblib`](../apps/ml-engine/live_win_predictor_model.joblib) · [`model_manifest.json`](../apps/ml-engine/model_manifest.json) · [`live_metadata.json`](../apps/ml-engine/live_metadata.json)                                       |
| **SHA-256 Checksum**             | `de9e39513fbac895df7c86c449ef0a6b687717b5d1f40af08b5a5b13aa37c0cf`                                                                                                                                                                                                          |
| **DVC Dataset Lineage**          | `dvc:31e19c47bdbc05d773938754d8589516` (`cricket-data/t20s_json.zip.dvc`, `dvc.yaml`, `dvc.lock`)                                                                                                                                                                           |
| **ECR Container Optimization**   | `public.ecr.aws/lambda/python:3.12` + `xgboost-cpu` (`~309 MB`, `countNumber = 1` single-image retention)                                                                                                                                                                   |
| **Dev ECR Image (`:v2.2.0`)**    | `294.75 MB` · Digest `sha256:9955c2c256465df582c855f22e2cece637e817e1d54438bce2b27f9623abb440` · Pushed `2026-10-31 21:11:25`                                                                                                                                               |
| **Prod ECR Image (`:v2.2.0`)**   | `652.12 MB` · Digest `sha256:63ae0a61524e23373133f8b7f1ad51cae58edd41617b7283c6af9e6459dd1dc1` · Pushed `2026-10-22 12:40:17`                                                                                                                                               |

### Champion vs. Baseline Benchmark Metrics

| Metric                  | Champion XGBoost (`v2.2.0`) | Baseline Logistic Reg (`v1.0.0`) | Improvement                                   |
| ----------------------- | --------------------------- | -------------------------------- | --------------------------------------------- |
| **Validation Log Loss** | **`0.5786`**                | `0.8069`                         | **-28.3% (Superior probability calibration)** |
| **Test Log Loss**       | **`0.6018`**                | —                                | **Stable out-of-sample generalization**       |
| **Validation Accuracy** | **`68.35%`**                | `65.59%`                         | **+2.76% raw gain**                           |
| **Test Accuracy**       | **`69.01%`**                | —                                | **Consistent match outcome classification**   |
| **Validation ROC-AUC**  | **`0.7723`**                | `0.755`                          | **+0.0173 discrimination power**              |
| **Test ROC-AUC**        | **`0.7529`**                | —                                | **Strong unseen match ranking**               |
| **Brier Score**         | **`0.1992`**                | `0.2379`                         | **-16.3% lower error variance**               |

---

## 🗄️ Database, Vectors & RAG Architecture (Aiven PostgreSQL)

| Component                         | Configuration / Schema Details                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Managed PostgreSQL 16**         | Host: `cricscore-db-venky-cric-score.b.aivencloud.com` · Port: `17727` · DB: `defaultdb` · [Aiven Console](https://console.aiven.io/)                      |
| **Schema Isolation & TLS**        | Isolated `dev` and `prod` schemas (`SET search_path`) over `sslmode=require` (`pg.Pool` max 5 connections)                                                 |
| **Core Relational Tables**        | `matches` (includes `ai_summary`, `player_of_the_match`), `innings`, `players`, `bowlers`, `balls`                                                         |
| **Vector RAG Table (`pgvector`)** | `tournament_rules` (`vector(1536)` embeddings + HNSW cosine index `vector_cosine_ops`)                                                                     |
| **Database Migrations**           | [`infra/database/schema.sql`](../infra/database/schema.sql) and [`infra/database/migrations/`](../infra/database/migrations/)                              |
| **4 MCP Specialist Tools**        | `execute_sql` (Match Stats), `search_tournament_rules` (`pgvector` RAG), `get_match_weather` (Open-Meteo), `create_github_issue` (GitHub API)              |
| **AI Documentation**              | [`ai_architecture.md`](./ai_architecture.md) · [`weather_report_agent.md`](./weather_report_agent.md) · [`github_issue_agent.md`](./github_issue_agent.md) |

---

## 📦 Storage, S3 Buckets & Terraform State

| Purpose                    | Environment | Bucket Name                                             | AWS Console Direct Link                                                                                                            |
| -------------------------- | ----------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Static Web Hosting**     | DEV         | `cricscoredev-app-e8d6bb50c5656dc8a2271c54a0`           | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-app-e8d6bb50c5656dc8a2271c54a0?region=us-east-1)           |
| **Static Web Hosting**     | PROD        | `cricscore-app-7e93ca64fca840e1639f6fbd71`              | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscore-app-7e93ca64fca840e1639f6fbd71?region=us-east-1)              |
| **Match Event Backups**    | DEV         | `cricscoredev-match-backups-937fe838a46144fff5facd682f` | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-match-backups-937fe838a46144fff5facd682f?region=us-east-1) |
| **Match Event Backups**    | PROD        | `cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d`    | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d?region=us-east-1)    |
| **CloudFront CDN Logs**    | DEV         | `cricscoredev-app-logs-a6dc993b498342c8e5800d409e`      | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-app-logs-a6dc993b498342c8e5800d409e?region=us-east-1)      |
| **CloudFront CDN Logs**    | PROD        | `cricscore-app-logs-b123ba8b0aa118a0a9fee8bbc2`         | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscore-app-logs-b123ba8b0aa118a0a9fee8bbc2?region=us-east-1)         |
| **Terraform Remote State** | GLOBAL      | `venky-2026-terraform-state`                            | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/venky-2026-terraform-state?region=us-east-1)                            |

- **Dev Terraform State Key**: `s3://venky-2026-terraform-state/cricscore/dev/terraform.tfstate`
- **Prod Terraform State Key**: `s3://venky-2026-terraform-state/cricscore/prod/terraform.tfstate`

---

## 🛡️ Security Posture, SBOM & CI/CD Scans

| Scanner / Guardrail  | Scope                                                  | Console / Workflow Link                                                                                                                                                           |
| -------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CodeQL SAST**      | JavaScript, TypeScript & Python static analysis        | [Code Scanning Console](https://github.com/venkatesh-singamsetty/cricscore/security/code-scanning)                                                                                |
| **Dependabot SCA**   | Automated npm, pip & GitHub Actions dependency updates | [Dependabot Alerts](https://github.com/venkatesh-singamsetty/cricscore/security/dependabot)                                                                                       |
| **GitLeaks**         | Secret detection on every commit and PR                | [`ci.yml`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml)                                                                                           |
| **Trivy**            | Filesystem & container HIGH/CRITICAL CVE scans         | [`ci.yml`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml)                                                                                           |
| **Checkov**          | Terraform IaC security & compliance checks             | [`ci.yml`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml)                                                                                           |
| **Syft SPDX SBOM**   | Software Bill of Materials (`spdx-json` artifact)      | [`sbom.yml`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/sbom.yml)                                                                                       |
| **OWASP ZAP (DAST)** | Live baseline dynamic security scan on `dev` & `prod`  | [`ci.yml`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml) · [`cd.yml`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/cd.yml) |

---

## 📊 Observability, Tracing & Alarms (AWS X-Ray & CloudWatch)

| Telemetry Surface         | Retention / Sampling                                             | AWS Console Link                                                                                                   |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **CloudWatch Log Groups** | **7-day retention** across all API Gateway & Lambda logs         | [Open Log Groups](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups)     |
| **CloudWatch Metrics**    | API Gateway requests, Lambda durations, SQS FIFO depth           | [Open Metrics](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#metricsV2)                |
| **AWS X-Ray Service Map** | **5% trace sampling** (`1 req/s` reservoir) across all 9 Lambdas | [Open Service Map](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:service-map/map) |
| **AWS X-Ray Traces**      | End-to-end waterfall latency analysis                            | [Open X-Ray Traces](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:traces/query)   |
| **CloudWatch Alarms**     | `match-api` & `score-upd` error alerts via SNS email             | [Open Alarms](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#alarmsV2:)                 |
