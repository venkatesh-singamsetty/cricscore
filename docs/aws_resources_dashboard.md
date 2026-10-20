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

- **GitHub Repository**: [`venkatesh-singamsetty/cricscore`](https://github.com/venkatesh-singamsetty/cricscore)
- **Default Branch**: `main` (Protected; all changes merge via pull requests)
- **Active Feature Branch**: `feat/python-ai-service`
- **GitHub Environments**: [`dev`](https://github.com/venkatesh-singamsetty/cricscore/deployments/activity_log?environment=dev) and [`prod`](https://github.com/venkatesh-singamsetty/cricscore/deployments/activity_log?environment=prod)
- **Releases & Version Tags**: [`GitHub Releases`](https://github.com/venkatesh-singamsetty/cricscore/releases) (Automated semantic versioning via `semantic-release`)

### ⚙️ GitHub Actions Workflow Catalog

| Workflow Name                      | File                                 | Trigger Events                       | Primary Responsibilities                                                                                | Direct Console Link                                                                                    |
| ---------------------------------- | ------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **CI (Continuous Integration)**    | `.github/workflows/ci.yml`           | Pull requests, push to `main`        | 4 validation suites: Security, Frontend, Backend, Python AI/ML; deploys and tests `dev` on `main` merge | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml)           |
| **CD (Continuous Delivery)**       | `.github/workflows/cd.yml`           | Release published (`v*`)             | Production deployment, Playwright E2E against Prod, OWASP ZAP baseline scan                             | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/cd.yml)           |
| **Semantic Release**               | `.github/workflows/release.yml`      | CI success on `main`                 | Analyzes conventional commits, cuts next `v*` tag, publishes release notes & updates changelog          | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/release.yml)      |
| **CodeQL SAST Analysis**           | `.github/workflows/codeql.yml`       | PRs, push to `main`, weekly schedule | Multi-language static application security testing (JS/TS & Python)                                     | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/codeql.yml)       |
| **Generate SBOM**                  | `.github/workflows/sbom.yml`         | Nightly / release                    | Generates Syft Software Bill of Materials in SPDX JSON format (`spdx-json` artifact)                    | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/sbom.yml)         |
| **MLOps Pipeline (Win Predictor)** | `.github/workflows/mlops.yml`        | Changes in `apps/ml-engine/**`       | Model benchmark evaluation, XGBoost champion verification, container build & ECR push                   | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/mlops.yml)        |
| **Terraform Drift Detection**      | `.github/workflows/drift-check.yml`  | Daily schedule                       | Verifies Terraform state synchronization with AWS resources                                             | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/drift-check.yml)  |
| **Database Keep-Alive**            | `.github/workflows/db-keepalive.yml` | Scheduled (every 4 hrs)              | Sends ping query to prevent Aiven PostgreSQL free service hibernation                                   | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/db-keepalive.yml) |
| **Terraform Force Unlock**         | `.github/workflows/unlock.yml`       | Manual `workflow_dispatch`           | Emergency administrative release of stuck S3 backend locks                                              | [Open Workflow](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/unlock.yml)       |
| **Dependabot Updates**             | `.github/dependabot.yml`             | Scheduled / auto                     | Automated security PRs for npm, pip, and GitHub Actions dependencies                                    | [Open Dependabot](https://github.com/venkatesh-singamsetty/cricscore/security/dependabot)              |

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

- **Software Bill of Materials (SPDX JSON)**: Downloadable artifact `spdx-json` on every run of [`Generate SBOM`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/sbom.yml).
- **CodeQL Analysis Databases & SARIF Reports**: Available under [`Security → Code scanning`](https://github.com/venkatesh-singamsetty/cricscore/security/code-scanning).
- **Trivy Container & Dependency Scan Reports**: Emitted in the CI step log output of [`ci.yml`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml).
- **GitLeaks Secrets Scan Audit**: Logged on every PR commit in [`ci.yml`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml).
- **Playwright E2E Test Reports**: Generated on deployment runs in [`ci.yml`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml) and [`cd.yml`](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/cd.yml).
- **Semantic Release Changelog**: Automatically published in [`docs/changelog.md`](file:///Users/venkat/workspace/gitRepos/cricscore/docs/changelog.md) and [`GitHub Releases`](https://github.com/venkatesh-singamsetty/cricscore/releases).

---

## 🟢 Development (DEV)

### 🌐 Core Endpoints & Networking

- **Frontend Web Application**: [https://cricscoredev.venkateshsingamsetty.com](https://cricscoredev.venkateshsingamsetty.com)
- **CloudFront CDN Distribution**: [`E1K3FWDNEXFSL0`](https://us-east-1.console.aws.amazon.com/cloudfront/v4/home?region=us-east-1#/distributions/E1K3FWDNEXFSL0)
- **HTTP API Gateway Endpoint**: [`https://api.cricscoredev.venkateshsingamsetty.com`](https://us-east-1.console.aws.amazon.com/apigateway/main/apis/sx6hhs0yj6/routes?region=us-east-1) (API ID: `sx6hhs0yj6`)
- **WebSocket API Gateway Endpoint**: [`wss://ws.cricscoredev.venkateshsingamsetty.com`](https://us-east-1.console.aws.amazon.com/apigateway/main/apis/ql2tnw8ls6/routes?region=us-east-1) (API ID: `ql2tnw8ls6`)
- **Route 53 DNS Hosted Zone**: [Route 53 Console](https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones)
- **ACM SSL/TLS Certificates**: [ACM Console](https://us-east-1.console.aws.amazon.com/acm/home?region=us-east-1#/certificates)

### 🔐 Identity, Authentication & SSO (Amazon Cognito)

- **User Pool ID**: [`us-east-1_InxzxljX7`](https://us-east-1.console.aws.amazon.com/cognito/v2/idp/user-pools/us-east-1_InxzxljX7/users?region=us-east-1)
- **App Client ID**: `1n4m9rm96nhkd1vnqpnfsr1eg9`
- **Cognito Hosted Domain Prefix**: `cricscoredev-auth-dev`
- **User Pool Console**: [Manage Users & Admin Groups](https://us-east-1.console.aws.amazon.com/cognito/v2/idp/user-pools/us-east-1_InxzxljX7/users?region=us-east-1)

### 📦 Storage, Backups & Event Bus

- **S3 Static Web Hosting**: [`s3://cricscoredev-app-e8d6bb50c5656dc8a2271c54a0`](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-app-e8d6bb50c5656dc8a2271c54a0?region=us-east-1)
- **S3 Match Backups**: [`s3://cricscoredev-match-backups-937fe838a46144fff5facd682f`](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-match-backups-937fe838a46144fff5facd682f?region=us-east-1)
- **S3 CloudFront Access Logs**: [`s3://cricscoredev-app-logs-ec6008161838564a0781274d49`](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-app-logs-ec6008161838564a0781274d49?region=us-east-1)
- **DynamoDB Connection Table**: [`cricscoredev-connections`](https://us-east-1.console.aws.amazon.com/dynamodbv2/home?region=us-east-1#item-explorer?table=cricscoredev-connections)
- **SQS FIFO Storage Buffer Queue**: [`cricscoredev-storage-buffer.fifo`](https://us-east-1.console.aws.amazon.com/sqs/v3/home?region=us-east-1#/queues/https%3A%2F%2Fsqs.us-east-1.amazonaws.com%2F926789386606%2Fcricscoredev-storage-buffer.fifo)
- **SNS Match Events Topic**: [`cricscoredev-match-events`](https://us-east-1.console.aws.amazon.com/sns/v3/home?region=us-east-1#/topic/arn:aws:sns:us-east-1:926789386606:cricscoredev-match-events)
- **SNS Lambda Alerts Topic**: [`cricscoredev-lambda-alerts`](https://us-east-1.console.aws.amazon.com/sns/v3/home?region=us-east-1#/topic/arn:aws:sns:us-east-1:926789386606:cricscoredev-lambda-alerts)
- **ECR Docker Image Repo**: [`cricscoredev-ml-predict`](https://us-east-1.console.aws.amazon.com/ecr/repositories/private/926789386606/cricscoredev-ml-predict?region=us-east-1)
  - **Latest Tag Digest**: `sha256:359dff98d3c287b4ef4a4cc411e5fb7a769a86f401c5a364e1151459703ab5c5`
  - **Image Size**: `652.11 MB` | **Last Pushed**: `2026-10-19 23:14:42`

### ⚡ Serverless Compute & Telemetry (AWS Lambda)

| Lambda Function         | Runtime                | Function Console                                                                                                                 | CloudWatch Logs                                                                                                                                                           |
| ----------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`broadcaster`**       | `Node.js 20.x`         | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-broadcaster)       | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-broadcaster)       |
| **`chat-api`**          | `Node.js 20.x`         | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-chat-api)          | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-chat-api)          |
| **`cognito-presignup`** | `Node.js 20.x`         | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-cognito-presignup) | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-cognito-presignup) |
| **`match-api`**         | `Node.js 20.x`         | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-match-api)         | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-match-api)         |
| **`ml-predict`**        | `Docker (Python 3.12)` | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-ml-predict)        | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-ml-predict)        |
| **`onconnect`**         | `Node.js 20.x`         | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-onconnect)         | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-onconnect)         |
| **`ondisconnect`**      | `Node.js 20.x`         | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-ondisconnect)      | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-ondisconnect)      |
| **`score-upd`**         | `Node.js 20.x`         | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-score-upd)         | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-score-upd)         |
| **`storage-worker`**    | `Node.js 20.x`         | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-storage-worker)    | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-storage-worker)    |

---

## 🔵 Production (PROD)

### 🌐 Core Endpoints & Networking

- **Frontend Web Application**: [https://cricscore.venkateshsingamsetty.com](https://cricscore.venkateshsingamsetty.com)
- **CloudFront CDN Distribution**: [`E3FVVHMKMZ5G5O`](https://us-east-1.console.aws.amazon.com/cloudfront/v4/home?region=us-east-1#/distributions/E3FVVHMKMZ5G5O)
- **HTTP API Gateway Endpoint**: [`https://api.cricscore.venkateshsingamsetty.com`](https://us-east-1.console.aws.amazon.com/apigateway/main/apis/ispht71fh0/routes?region=us-east-1) (API ID: `ispht71fh0`)
- **WebSocket API Gateway Endpoint**: [`wss://ws.cricscore.venkateshsingamsetty.com`](https://us-east-1.console.aws.amazon.com/apigateway/main/apis/to0pkago8j/routes?region=us-east-1) (API ID: `to0pkago8j`)
- **Route 53 DNS Hosted Zone**: [Route 53 Console](https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones)
- **ACM SSL/TLS Certificates**: [ACM Console](https://us-east-1.console.aws.amazon.com/acm/home?region=us-east-1#/certificates)

### 🔐 Identity, Authentication & SSO (Amazon Cognito)

- **User Pool ID**: [`us-east-1_7OssmfCnh`](https://us-east-1.console.aws.amazon.com/cognito/v2/idp/user-pools/us-east-1_7OssmfCnh/users?region=us-east-1)
- **App Client ID**: `5gn0fv3ha5m7t7ah66quuavhv5`
- **Cognito Hosted Domain Prefix**: `cricscore-auth-prod`
- **User Pool Console**: [Manage Users & Admin Groups](https://us-east-1.console.aws.amazon.com/cognito/v2/idp/user-pools/us-east-1_7OssmfCnh/users?region=us-east-1)

### 📦 Storage, Backups & Event Bus

- **S3 Static Web Hosting**: [`s3://cricscore-app-7e93ca64fca840e1639f6fbd71`](https://s3.console.aws.amazon.com/s3/buckets/cricscore-app-7e93ca64fca840e1639f6fbd71?region=us-east-1)
- **S3 Match Backups**: [`s3://cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d`](https://s3.console.aws.amazon.com/s3/buckets/cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d?region=us-east-1)
- **S3 CloudFront Access Logs**: [`s3://cricscore-app-logs-b123ba8b0aa118a0a9fee8bbc2`](https://s3.console.aws.amazon.com/s3/buckets/cricscore-app-logs-b123ba8b0aa118a0a9fee8bbc2?region=us-east-1)
- **DynamoDB Connection Table**: [`cricscore-connections`](https://us-east-1.console.aws.amazon.com/dynamodbv2/home?region=us-east-1#item-explorer?table=cricscore-connections)
- **SQS FIFO Storage Buffer Queue**: [`cricscore-storage-buffer.fifo`](https://us-east-1.console.aws.amazon.com/sqs/v3/home?region=us-east-1#/queues/https%3A%2F%2Fsqs.us-east-1.amazonaws.com%2F926789386606%2Fcricscore-storage-buffer.fifo)
- **SNS Match Events Topic**: [`cricscore-match-events`](https://us-east-1.console.aws.amazon.com/sns/v3/home?region=us-east-1#/topic/arn:aws:sns:us-east-1:926789386606:cricscore-match-events)
- **SNS Lambda Alerts Topic**: [`cricscore-lambda-alerts`](https://us-east-1.console.aws.amazon.com/sns/v3/home?region=us-east-1#/topic/arn:aws:sns:us-east-1:926789386606:cricscore-lambda-alerts)
- **ECR Docker Image Repo**: [`cricscore-ml-predict`](https://us-east-1.console.aws.amazon.com/ecr/repositories/private/926789386606/cricscore-ml-predict?region=us-east-1)
  - **Latest Tag Digest**: `sha256:60b781245f820cb52592c27596205f13012ad6f91094e21849ea25b62b85a1fc`
  - **Image Size**: `652.11 MB` | **Last Pushed**: `2026-10-20 00:02:21`

### ⚡ Serverless Compute & Telemetry (AWS Lambda)

| Lambda Function         | Runtime                | Function Console                                                                                                              | CloudWatch Logs                                                                                                                                                        |
| ----------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`broadcaster`**       | `Node.js 20.x`         | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-broadcaster)       | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-broadcaster)       |
| **`chat-api`**          | `Node.js 20.x`         | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-chat-api)          | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-chat-api)          |
| **`cognito-presignup`** | `Node.js 20.x`         | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-cognito-presignup) | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-cognito-presignup) |
| **`match-api`**         | `Node.js 20.x`         | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-match-api)         | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-match-api)         |
| **`ml-predict`**        | `Docker (Python 3.12)` | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-ml-predict)        | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-ml-predict)        |
| **`onconnect`**         | `Node.js 20.x`         | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-onconnect)         | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-onconnect)         |
| **`ondisconnect`**      | `Node.js 20.x`         | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-ondisconnect)      | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-ondisconnect)      |
| **`score-upd`**         | `Node.js 20.x`         | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-score-upd)         | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-score-upd)         |
| **`storage-worker`**    | `Node.js 20.x`         | [Open Function](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-storage-worker)    | [View Logs](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-storage-worker)    |

---

## 🤖 ML Models, Container Images & MLOps Registry

### Active Champion Model Architecture

- **Champion Version**: `v2.2.0` (XGBoost)
- **Local Model Artifact**: [`apps/ml-engine/live_win_predictor_model.joblib`](file:///Users/venkat/workspace/gitRepos/cricscore/apps/ml-engine/live_win_predictor_model.joblib)
- **Baseline Fallback Model**: [`apps/ml-engine/win_predictor_model.joblib`](file:///Users/venkat/workspace/gitRepos/cricscore/apps/ml-engine/win_predictor_model.joblib)
- **Model Manifest Specification**: [`apps/ml-engine/model_manifest.json`](file:///Users/venkat/workspace/gitRepos/cricscore/apps/ml-engine/model_manifest.json)
- **Live Metadata Contract**: [`apps/ml-engine/live_metadata.json`](file:///Users/venkat/workspace/gitRepos/cricscore/apps/ml-engine/live_metadata.json)
- **SHA-256 Checksum**: `de9e39513fbac895df7c86c449ef0a6b687717b5d1f40af08b5a5b13aa37c0cf`
- **Dataset Tracking (DVC)**: `dvc:31e19c47bdbc05d773938754d8589516` (84,129 train balls, 18,342 test balls from Cricsheet T20s)
- **Local MLflow Experiment Tracking**: `apps/ml-engine/mlruns/`

### Champion vs. Baseline Benchmark Metrics

| Metric                  | Champion XGBoost (`v2.2.0`) | Baseline Logistic Reg (`v1.0.0`) | Improvement                                   |
| ----------------------- | --------------------------- | -------------------------------- | --------------------------------------------- |
| **Validation Log Loss** | **`0.5786`**                | `0.8069`                         | **-28.3% (Superior probability calibration)** |
| **Test Log Loss**       | **`0.6018`**                | —                                | **Stable out-of-sample generalization**       |
| **Validation Accuracy** | **`68.35%`**                | `65.59%`                         | **+2.76% raw gain**                           |
| **Test Accuracy**       | **`69.01%`**                | —                                | **Consistent match outcome classification**   |
| **Validation ROC-AUC**  | **`0.7723`**                | `0.755`                          | **+0.0173 discrimination power**              |
| **Brier Score**         | **`0.1992`**                | `0.2379`                         | **-16.3% lower error variance**               |

### Docker Container Images (AWS ECR)

- **Base Image**: `public.ecr.aws/lambda/python:3.12` (Container architecture: `linux/amd64`)
- **Dev ECR Repository**: [`cricscoredev-ml-predict`](https://us-east-1.console.aws.amazon.com/ecr/repositories/private/926789386606/cricscoredev-ml-predict?region=us-east-1)
  - **Latest Image URI**: `926789386606.dkr.ecr.us-east-1.amazonaws.com/cricscoredev-ml-predict:latest`
  - **Digest**: `sha256:359dff98d3c287b4ef4a4cc411e5fb7a769a86f401c5a364e1151459703ab5c5` | **Size**: `652.11 MB` | **Pushed**: `2026-10-19 23:14:42`
- **Prod ECR Repository**: [`cricscore-ml-predict`](https://us-east-1.console.aws.amazon.com/ecr/repositories/private/926789386606/cricscore-ml-predict?region=us-east-1)
  - **Latest Image URI**: `926789386606.dkr.ecr.us-east-1.amazonaws.com/cricscore-ml-predict:latest`
  - **Digest**: `sha256:60b781245f820cb52592c27596205f13012ad6f91094e21849ea25b62b85a1fc` | **Size**: `652.11 MB` | **Pushed**: `2026-10-20 00:02:21`

---

## 🗄️ Database, Vectors & RAG Architecture (Aiven PostgreSQL)

### Managed PostgreSQL 16 Service

- **Console UI**: [Aiven Web Console](https://console.aiven.io/)
- **Host**: `cricscore-db-venky-cric-score.b.aivencloud.com` | **Port**: `17727` | **Database Name**: `defaultdb`
- **Vector Extension**: `pgvector` enabled
- **SSL Enforcement**: Mandatory `sslmode=require` with connection pooling (`pg.Pool` bounded to 5 clients)

### Schemas & Key Database Tables

- **Relational Match & Inning Engine**: `matches`, `innings`, `balls`, `players`
- **Security & Identity**: `app_users`, `admin_roles` (Server-side role verification guard)
- **RAG Vector Knowledge Base**: `cricket_rule_chunks`
  - Embeddings: 1536-dimensional float vectors (`vector(1536)`)
  - Index: Cosine distance HNSW index (`USING hnsw (embedding vector_cosine_ops)`)
- **AI Chat Session Memory**: `chat_history` (Parameterized SQL session tracking)
- **AI Analysis Cache**: `match_summaries` (Cached LLM post-match breakdowns)

### Database Migrations Directory

- `infra/database/schema.sql`: Core relational schemas and indexes
- `infra/database/migrations/add_ai_summary.sql`: Post-match AI summary cache
- `infra/database/migrations/add_rule_chunks_table.sql`: MCC Cricket Rulebook embeddings storage
- `infra/database/migrations/add_pgvector_hnsw_index.sql`: HNSW high-speed vector retrieval index

---

## 📦 Storage, S3 Buckets & Terraform State

| Purpose                    | Environment | Bucket Name                                             | AWS Console Direct Link                                                                                                            |
| -------------------------- | ----------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Static Web Hosting**     | DEV         | `cricscoredev-app-e8d6bb50c5656dc8a2271c54a0`           | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-app-e8d6bb50c5656dc8a2271c54a0?region=us-east-1)           |
| **Static Web Hosting**     | PROD        | `cricscore-app-7e93ca64fca840e1639f6fbd71`              | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscore-app-7e93ca64fca840e1639f6fbd71?region=us-east-1)              |
| **Match Event Backups**    | DEV         | `cricscoredev-match-backups-937fe838a46144fff5facd682f` | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-match-backups-937fe838a46144fff5facd682f?region=us-east-1) |
| **Match Event Backups**    | PROD        | `cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d`    | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d?region=us-east-1)    |
| **CloudFront CDN Logs**    | DEV         | `cricscoredev-app-logs-ec6008161838564a0781274d49`      | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscoredev-app-logs-ec6008161838564a0781274d49?region=us-east-1)      |
| **CloudFront CDN Logs**    | PROD        | `cricscore-app-logs-b123ba8b0aa118a0a9fee8bbc2`         | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/cricscore-app-logs-b123ba8b0aa118a0a9fee8bbc2?region=us-east-1)         |
| **Terraform Remote State** | GLOBAL      | `venky-2026-terraform-state`                            | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/venky-2026-terraform-state?region=us-east-1)                            |

- **Dev Terraform State Key**: `s3://venky-2026-terraform-state/cricscore/dev/terraform.tfstate`
- **Prod Terraform State Key**: `s3://venky-2026-terraform-state/cricscore/prod/terraform.tfstate`

---

## 🛡️ Security Posture, SBOM & CI/CD Scans

### Automated Security Scanners

- [**CodeQL SAST Alerts**](https://github.com/venkatesh-singamsetty/cricscore/security/code-scanning): Native GitHub static application security testing for JavaScript, TypeScript, and Python.
- [**Dependabot SCA Alerts**](https://github.com/venkatesh-singamsetty/cricscore/security/dependabot): Automated dependency vulnerability detection.
- [**GitLeaks Secrets Guard**](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml): Zero secret leaks enforced on every commit and PR.
- [**Trivy Container & Dependency Scanner**](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml): Container image vulnerability scans.
- [**Checkov IaC Scanner**](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml): Terraform configuration security checks (0 failed checks enforced).
- [**Syft SBOM Pipeline**](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/sbom.yml): Software Bill of Materials (available as downloadable artifact `spdx-json`).
- [**OWASP ZAP Dynamic Scanner (DAST)**](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci.yml): Automated baseline web app security scanning on dev deployments.

---

## 📊 Observability, Tracing & Alarms (AWS X-Ray & CloudWatch)

- [**CloudWatch All Log Groups**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups): Direct inspection of all Lambda stdout/stderr logs (retention capped at 7 days).
- [**CloudWatch Custom Metrics**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#metricsV2): API Gateway request counts, Lambda durations, SQS queue depths.
- [**AWS X-Ray Service Map**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:service-map/map): Distributed trace visualizer mapping API Gateway → Lambda → SNS → Database.
- [**AWS X-Ray Traces Dashboard**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:traces/query): Latency breakdowns and HTTP timeline waterfall queries.
- [**CloudWatch Alarms Dashboard**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#alarmsV2:): Active alarms for Match API 5xx errors and Score Update failures.
