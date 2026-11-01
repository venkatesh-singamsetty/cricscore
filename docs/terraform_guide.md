# 🏗️ CricScore Terraform Infrastructure Guide & Tutorial

Step-by-step reference and operational guide for managing CricScore's AWS Infrastructure as Code (IaC) with **Terraform `>= 1.10.0`** (`~$1/month` total AWS run rate across `dev` + `prod` combined).

> [!IMPORTANT]
> For initial account setup, Route 53 bootstrap, and one-command deployment, follow the [Deployment Guide](./deployment.md). Use the manual Terraform commands below when inspecting plans, debugging state, or reviewing infrastructure changes prior to apply.

---

## 🎯 Infrastructure Overview

```mermaid
graph TD
    subgraph CDN ["1. Edge, DNS & SSL Layer"]
        R53[AWS Route 53 DNS] --> ACM[AWS Certificate Manager TLS]
        ACM --> CF[AWS CloudFront CDN + OAC]
        CF --> S3[AWS S3: Static React SPA + Access Logs]
    end

    subgraph API ["2. Auth, API Gateway & IAM Layer"]
        AMP[AWS Amplify Auth SDK & UI]
        HTTP_GW[API Gateway v2 HTTP API]
        WS_GW[API Gateway WebSocket API]
        COG[AWS Cognito User Pool & Admin Group]
        L_AUTH[cognito-presignup Lambda]
        IAM[AWS IAM Least-Privilege Roles]
        AMP --> COG --> L_AUTH
        HTTP_GW --> COG
    end

    subgraph COMPUTE ["3. Serverless Compute (9 Lambdas)"]
        L_MATCH[match-api Lambda]
        L_SCORE[score-update Lambda]
        L_WORKER[storage-worker Lambda]
        L_BROAD[broadcaster Lambda]
        L_SESS[onconnect / ondisconnect Lambdas]
        L_CHAT[chat-api Agentic AI Lambda]
        L_ML[ml-predict Container Lambda]
    end

    subgraph MSG ["4. Event-Driven Messaging & Registries"]
        SNS{AWS SNS Match Events Topic}
        SQS[[AWS SQS FIFO Storage Queue]]
        DDB[(DynamoDB WebSocket Registry)]
        ECR[Amazon ECR: xgboost-cpu ~309 MB]
        S3_BAK[(Amazon S3: Match Backups & ML Model Registry)]
        SES[Amazon SES Scorecard Email]
        PG[(Aiven PostgreSQL 16 + pgvector)]
    end

    subgraph OBS ["5. Observability & Cost Guardrails"]
        CW[CloudWatch Logs 7d & Alarms]
        XRAY[AWS X-Ray 5% Sampling]
        BUD[AWS Budgets $5/mo limit alert]
    end

    R53 --> HTTP_GW
    R53 --> WS_GW
    HTTP_GW --> L_MATCH
    HTTP_GW --> L_SCORE
    HTTP_GW --> L_CHAT
    HTTP_GW --> L_ML
    WS_GW --> L_SESS
    L_SESS --> DDB
    L_SCORE --> SNS
    L_SCORE --> SQS
    L_MATCH -->|Direct Invoke: HUB_UPDATE| L_BROAD
    L_MATCH --> PG
    L_MATCH --> SES
    L_MATCH --> S3_BAK
    SQS --> L_WORKER --> PG
    SNS --> L_BROAD
    L_BROAD --> DDB
    L_BROAD --> WS_GW
    ECR --> L_ML
    S3_BAK --> L_ML
    L_CHAT --> PG
```

---

## 📁 Terraform File Directory Layout

All root configuration files live in `infra/terraform/` (with one-time state/DNS bootstrap in `infra/terraform/bootstrap/` and reusable Lambda packaging in `infra/terraform/modules/zip_lambda/`):

- **Core Configuration (`providers.tf`, `variables.tf`, `outputs.tf`, `environments/*.tfvars`):**
  - **`providers.tf`:** Configures S3 remote backend with native `.tflock` locking (`use_lockfile = true`, no DynamoDB lock table required) and AWS providers (`us-east-1` for ACM/CloudFront).
  - **`variables.tf`:** Defines input variables (`environment`, `domain_name`, `database_url`, `llm_api_key`, `ml_model_version`) and marks all secrets `sensitive = true`.
  - **`outputs.tf`:** Exports `http_api_url`, `websocket_url`, `s3_bucket_name`, `cognito_user_pool_id`, and `cloudfront_distribution_id` for `deploy.sh`, `ci.yml`, and `cd.yml`.
  - **`environments/*.tfvars`:** Provides isolated `dev.tfvars` and `prod.tfvars` environment defaults.
- **Serverless Compute & ML Container (`lambda.tf`):**
  - Provisions 8 Node.js 24 ZIP Lambdas (`modules/zip_lambda`) and 1 Python 3.12 Docker Lambda (`ml-predict` running `XGBoost v2.2.0`).
  - Builds the CPU-only `xgboost-cpu ~309 MB` container image, enforces ECR lifecycle `countNumber = 1` (`< 0.62 GB` across `dev` + `prod`), and sets 7-day CloudWatch log retention.
- **API Gateways & Auth (`apigateway_http.tf`, `apigateway_websocket.tf`, `cognito.tf`, `iam.tf`):**
  - **`apigateway_http.tf`:** API Gateway v2 HTTP API (`api.<domain>`), routes (`/matches`, `/match/*`, `/chat`, `/rules/upload`), Cognito JWT authorizer, and strict frontend CORS.
  - **`apigateway_websocket.tf`:** API Gateway v2 WebSocket API (`ws.<domain>`) with `$connect` and `$disconnect` routes (`prod` stage).
  - **`cognito.tf`:** Cognito User Pool, SPA App Client, `Admin` group, User Pool Domain, and Pre-SignUp Lambda trigger (Free Tier up to 50,000 MAUs).
  - **`iam.tf`:** Least-privilege IAM execution role and scoped policies (DynamoDB, SQS, SNS, SES, S3, CloudWatch, X-Ray) locked to project resource ARNs.
- **Event Messaging & Storage (`messaging.tf`, `frontend.tf`, `s3_backups.tf`, `kms_and_logging.tf`):**
  - **`messaging.tf`:** SNS `match_events` topic, SQS FIFO `storage_buffer.fifo` queue (content-based deduplication, 1-day retention), and DynamoDB `connections` table (`PAY_PER_REQUEST`).
  - **`frontend.tf`:** Private S3 static SPA bucket, CloudFront CDN with Origin Access Control (OAC), ACM TLS 1.2+ certs, and Route 53 alias records.
  - **`s3_backups.tf`:** Match JSON backups bucket (180-day lifecycle expiration, AES-256 encryption) and versioned ML model registry (`models/${var.ml_model_version}/`).
  - **`kms_and_logging.tf`:** S3 access-logging bucket with public-access block and 30-day lifecycle expiration.
- **Observability & Cost Protection (`cost_budget.tf`, `xray.tf`):**
  - **`cost_budget.tf`:** AWS Budgets monthly cost guardrail (`$5.00/month` limit) alerting `admin_email` at 80% (`$4.00`) spend.
  - **`xray.tf`:** AWS X-Ray sampling rule (`cricscore-low-cost-sampling`) with `fixed_rate = 0.05` (5% sampling) and `reservoir_size = 1` (100% within Free Tier).

---

## 🔄 Environment Isolation (`dev` vs `prod`)

CricScore isolates `dev` and `prod` using **separate S3 state keys, separate `.tflock` lock files, and per-environment variable files** (not Terraform workspaces):

| Dimension             | Dev Environment                          | Prod Environment                          |
| :-------------------- | :--------------------------------------- | :---------------------------------------- |
| **State Bucket**      | `$TF_STATE_BUCKET`                       | `$TF_STATE_BUCKET`                        |
| **S3 State Key**      | `cricscore/dev/terraform.tfstate`        | `cricscore/prod/terraform.tfstate`        |
| **S3 Lock Object**    | `cricscore/dev/terraform.tfstate.tflock` | `cricscore/prod/terraform.tfstate.tflock` |
| **tfvars File**       | `environments/dev.tfvars`                | `environments/prod.tfvars`                |
| **Resource Prefix**   | `cricscoredev-*`                         | `cricscore-*`                             |
| **PostgreSQL Schema** | `dev` (shared Aiven DB)                  | `prod` (shared Aiven DB)                  |

---

## 🛠️ Step-by-Step Terraform Operations

### Prerequisites

| Requirement          | Verification Command            | Expected Result                             |
| :------------------- | :------------------------------ | :------------------------------------------ |
| **Terraform CLI**    | `terraform version`             | `Terraform v1.10.x` or newer                |
| **AWS Credentials**  | `aws sts get-caller-identity`   | Returns IAM User ARN & Account ID           |
| **Docker Daemon**    | `docker info`                   | Running (for `ml-predict` image build)      |
| **Local Env Config** | `test -f .env.local && echo OK` | `OK` (per [deployment.md](./deployment.md)) |

### Step 1: Validate syntax and formatting (no AWS calls)

```bash
terraform fmt -check -recursive
terraform -chdir=infra/terraform init -backend=false
terraform -chdir=infra/terraform validate
```

### Step 2: Generate an environment-specific execution plan (`dev` or `prod`)

```bash
set -a && source ./.env.local && set +a

ENV=dev   # Change to 'prod' to preview production changes
if [ "$ENV" = "dev" ]; then
  DEPLOY_DOMAIN="${DEV_DOMAIN_NAME:-${SUBDOMAIN_PREFIX}dev.${ZONE_DOMAIN}}"
  DEPLOY_PROJECT="${DEV_PROJECT_NAME:-${PROJECT_NAME}dev}"
  DEPLOY_PREFIX="${DEV_SUBDOMAIN_PREFIX:-${SUBDOMAIN_PREFIX}dev}"
else
  DEPLOY_DOMAIN="${PROD_DOMAIN_NAME:-${DOMAIN_NAME:-${SUBDOMAIN_PREFIX}.${ZONE_DOMAIN}}}"
  DEPLOY_PROJECT="${PROD_PROJECT_NAME:-$PROJECT_NAME}"
  DEPLOY_PREFIX="${PROD_SUBDOMAIN_PREFIX:-$SUBDOMAIN_PREFIX}"
fi

export TF_VAR_aws_region="${AWS_REGION:-us-east-1}"
export TF_VAR_database_url="$TF_DATABASE_URL"
export TF_VAR_ses_source_email="$TF_SES_SOURCE_EMAIL"
export TF_VAR_admin_email="${ADMIN_EMAIL:-admin@example.com}"
export TF_VAR_llm_api_key="${OPENAI_API_KEY:-${LLM_API_KEY:-}}"
export TF_VAR_openai_api_key="${OPENAI_API_KEY:-}"
export TF_VAR_llm_base_url="${LLM_BASE_URL:-https://api.openai.com/v1}"
export TF_VAR_llm_model="${LLM_MODEL:-gpt-4o-mini}"

terraform -chdir=infra/terraform init -reconfigure -upgrade \
  -backend-config="bucket=$TF_STATE_BUCKET" \
  -backend-config="key=cricscore/$ENV/terraform.tfstate"

terraform -chdir=infra/terraform plan \
  -var-file="environments/$ENV.tfvars" \
  -var="domain_name=$DEPLOY_DOMAIN" \
  -var="zone_domain=$ZONE_DOMAIN" \
  -var="project_name=$DEPLOY_PROJECT" \
  -var="subdomain_prefix=$DEPLOY_PREFIX" \
  -out="$ENV.tfplan"
```

> [!CAUTION]
> Always delete local `*.tfplan` files after inspection (`rm -f infra/terraform/*.tfplan`) as Terraform plan binaries contain resolved secret variables in plaintext.

### Step 3: Apply and publish

For full end-to-end deployment (Lambda hydration, `terraform init -upgrade`, `terraform apply`, 7-day CloudWatch log retention enforcement, frontend build, S3 sync, and CloudFront cache invalidation), always run the canonical deploy script (see [Deployment Guide — Step 4: Deploy](./deployment.md#step-4-deploy)):

```bash
# Deploy Dev (add --migrate when schema changes exist)
./infra/scripts/deploy.sh --env dev --use-local-env

# Deploy Prod (add --migrate when schema changes exist)
./infra/scripts/deploy.sh --env prod --use-local-env
```

### Step 4: Inspect deployed outputs

```bash
terraform -chdir=infra/terraform output
```

| Output Name                  | Description                       |
| :--------------------------- | :-------------------------------- |
| `website_url`                | CloudFront custom domain URL      |
| `http_api_url`               | API Gateway v2 HTTP endpoint      |
| `websocket_url`              | API Gateway v2 WebSocket endpoint |
| `cognito_user_pool_id`       | Cognito User Pool ID              |
| `cognito_client_id`          | Cognito SPA App Client ID         |
| `s3_bucket_name`             | Frontend SPA hosting bucket       |
| `cloudfront_distribution_id` | CloudFront Distribution ID        |

---

## 🔒 State Management & Force Unlock

- **Normal Operation (Native S3 Locking):**
  - `use_lockfile = true` automatically creates and removes `cricscore/<env>/terraform.tfstate.tflock` in S3 during `plan` and `apply`.
- **Stale Lock in GitHub CI (`terraform-unlock.yml`):**
  - Trigger the **Terraform Force Unlock** workflow in GitHub Actions with `environment` and `lock_id`:
  - `gh workflow run terraform-unlock.yml -f environment=dev -f lock_id=<LOCK_ID>`
- **Stale Lock via Local CLI:**
  - Initialize the target environment backend and run:
  - `terraform -chdir=infra/terraform force-unlock <LOCK_ID>`

---

## 📖 Useful Operational Commands

```bash
# 1. Detect out-of-band AWS drift without mutating state (exit code 2 = drift detected)
terraform -chdir=infra/terraform plan -detailed-exitcode -var-file="environments/dev.tfvars"

# 2. Force-recreate a single Lambda function (e.g., match-api)
terraform -chdir=infra/terraform apply -var-file="environments/dev.tfvars" \
  -replace="module.match_api.aws_lambda_function.this"

# 3. Refresh state from live AWS APIs only
terraform -chdir=infra/terraform plan -refresh-only -var-file="environments/dev.tfvars"

# 4. Enforce 7-day retention on all Lambda CloudWatch Log Groups (automatically run by deploy.sh, ci.yml, and cd.yml)
for lg in $(aws logs describe-log-groups --region us-east-1 --log-group-name-prefix "/aws/lambda/cricscore-" --query "logGroups[].logGroupName" --output text); do
  aws logs put-retention-policy --region us-east-1 --log-group-name "$lg" --retention-in-days 7
done
```

---

© 2026 CricScore Infrastructure & DevOps. 🏎️🏁🚀
