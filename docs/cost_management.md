# 💰 Cloud Cost & Infrastructure Management

This document provides estimated operational costs for the CricScore platform. Free-tier eligibility, allowances, and service pricing vary; treat the figures below as estimates and check the current AWS pricing for your account, region, and deployment.

## 🏗️ AWS Infrastructure (US-East-1 Estimates)

### 1. **Compute: AWS Lambda**

- **Free Tier Limit**: 1,000,000 Requests AND 400,000 GB-Seconds per month.
- **The Fan-Out Multiplier (3x)**: Every single ball event (1 click) triggers **3 Lambda invocations** (`score-upd` $\rightarrow$ `broadcaster` + `storage-worker`).
- **Cognito Pre-Signup Lambda**: A lightweight `cognito-presignup` Lambda is invoked on each new user registration. Guest accounts (`guest-*@cricscore.local`) auto-confirm; normal accounts go through standard Cognito email verification.
- **Est. Max Load**: 1M requests / 3 Lambdas = 333,333 ball events = **~1,350 Matches per month** remaining within the AWS Lambda request allowance.
- **Lambda Function Sizing & Timeout Matrix (`infra/terraform/lambda.tf`)**:

| Function                      | Package Type | Memory    | Timeout | Log Retention | Primary Role                                                        |
| :---------------------------- | :----------- | :-------- | :------ | :------------ | :------------------------------------------------------------------ |
| `<project>-match-api`         | ZIP (Node24) | `128 MB`  | `30s`   | `7 days`      | Match CRUD, deep-link hydration, admin ops, SES email, S3 backup    |
| `<project>-score-upd`         | ZIP (Node24) | `256 MB`  | `30s`   | `7 days`      | Validates ball events and fans out to SNS + SQS FIFO                |
| `<project>-storage-worker`    | ZIP (Node24) | `256 MB`  | `30s`   | `7 days`      | Consumes SQS FIFO (`batch_size = 1`) and writes to PostgreSQL       |
| `<project>-broadcaster`       | ZIP (Node24) | `128 MB`  | `10s`   | `7 days`      | Consumes SNS events and pushes WebSocket frames via API Gateway     |
| `<project>-onconnect`         | ZIP (Node24) | `128 MB`  | `10s`   | `7 days`      | Registers active spectator WebSocket `connectionId` in DynamoDB     |
| `<project>-ondisconnect`      | ZIP (Node24) | `128 MB`  | `10s`   | `7 days`      | Removes disconnected spectator `connectionId` from DynamoDB         |
| `<project>-cognito-presignup` | ZIP (Node24) | `128 MB`  | `10s`   | `7 days`      | Auto-confirms `guest-*@cricscore.local` shadow accounts             |
| `<project>-chat-api`          | ZIP (Node24) | `1024 MB` | `30s`   | `7 days`      | Read-only Agentic RAG (`pgvector` + execute_sql guard + AI summary) |
| `<project>-ml-predict`        | ECR Image    | `1024 MB` | `30s`   | `7 days`      | XGBoost (`v2.2.0`, S3 versioned model registry) + Markov DP + DLS   |

### 2. **Real-time: WebSocket API Gateway**

- **Free Tier Limit**: 1,000,000 Messages + 750,000 Connection Minutes per month.
- **Cost After Tier**: $1.00 per 1M messages.
- **Multiplier (`X`)**: For every 1 ball scored, API Gateway pushes **`X` messages** (Where `X` is the number of active, live spectators). If 100 fans watch 1 over (6 balls), it costs 600 messages.

### 3. **Messaging & Buffering (AWS SNS & SQS)**

- **SNS (Fan-Out Hub)**: First 1,000,000 Publishes + 100,000 HTTP Deliveries per month are **FREE**.
- **SQS (Reliability Buffer)**: The configured queue is FIFO (`storage-buffer.fifo`), so do not apply the Standard SQS free-request allowance to its requests. Check current FIFO pricing and free-tier eligibility.
- **The Multiplier**: A score update sends one SNS publish and one direct SQS FIFO message (`MessageGroupId = matchId`). The SNS topic invokes `broadcaster` directly.
- **Est. Usage**: 300,000 ball events comfortably fit within typical allowances.
- **Encryption**: SNS uses `alias/aws/sns` (AWS-managed, **free**). SQS uses `sqs_managed_sse_enabled` (**free**).

### 4. **Storage: Amazon S3 & DynamoDB**

- **S3 (App Hosting)**: First 5GB of Standard Storage + 20,000 GET requests per month are **FREE**. (The React app is ~5MB).
- **S3 Encryption**: Uses SSE-S3 (`AES256`) — AWS-managed, **$0/month**.
- **S3 Match Backups**: A dedicated `match-backups` bucket stores JSON snapshots of completed matches at the time of email report generation (triggered by `POST /match/{id}/email`). Each snapshot is ~5–15KB. 1,000 matches ≈ **15MB total** — well within the 5GB free tier. **Cost: $0/month**.
- **DynamoDB**: `PAY_PER_REQUEST` on-demand capacity mode (25GB of Storage + 2.5 Million Read/Write capacity per month in standard free-tier allowances). Spectator connection tracking is negligible.

### 5. **Delivery: CloudFront & Route 53**

- **CloudFront**: First 1TB of data transfer out is **FREE**. Effectively $0 for this app's payload.
- **Route 53**: Hosting a custom domain (e.g., `cricscore.example.com`) incurs a fixed cost of **$0.50 per month** per hosted zone + domain registration fees.

### 6. **Reporting: AWS SES (Email)**

- **Cost**: First 62,000 emails per month are **FREE** when sent from AWS Lambda.
- **Usage**: Each match conclusion triggers 1 auto-email to fans/admins. Even with extreme usage (1,000 matches), this remains well within the $0 cost tier.

### 7. **Monitoring: AWS CloudWatch Alarms & Logs**

- **Cost**: First **10 alarms** and first **5GB of log ingestion/storage** per month are **FREE**.
- **Usage**: The platform provisions 2 alarms (`match-api-errors`, `score-update-errors`) and enforces `retention_in_days = 7` on all Lambda log groups. **$0/month**.
- **Includes SNS email alerts** — SNS topic and email subscription are both within the SNS free tier.

### 8. **Distributed Tracing: AWS X-Ray**

- **Cost**: First 100,000 traces recorded per month are **FREE**.
- **Usage**: The sampling rule in `infra/terraform/xray.tf` has a 5% fixed rate and a one-request-per-second reservoir. Actual trace volume depends on traffic and sampling behavior; it is not guaranteed to equal 5% of requests.

### 9. **CloudWatch Dashboard** _(removed — paid)_

- **Cost**: **$3.00/month** per dashboard. No free tier.
- **Decision**: The current Terraform configuration does not provision an `aws_cloudwatch_dashboard`, avoiding the recurring $3/month charge.
- **Alternative**: The repository auto-generates [`docs/aws_resources_dashboard.md`](./aws_resources_dashboard.md) on every commit with direct deep-links to the [CloudWatch Metrics console](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#metricsV2).

### 10. **CI/CD Automation: GitHub Actions**

- **Cost**: First 2,000 execution minutes per month are **FREE** for private repositories (Unlimited for public).
- **Usage**: CI/CD checks, Semantic Releases, Drift Detection, and E2E Tests use a fraction of these minutes. $0/month.

### 11. **Encryption: AWS KMS** _(removed)_

- **Previously**: A Customer Managed Key (CMK) was used to encrypt S3, SNS, and SQS resources, costing **$1.00/month** per key + API call charges (~$2/month total).
- **Now**: All resources use free AWS-managed encryption:
  - S3 → `SSE-S3 (AES256)` — **$0**
  - SNS → `alias/aws/sns` — **$0**
  - SQS → `sqs_managed_sse_enabled` — **$0**
- **Saving**: ~$2.00/month eliminated with no reduction in encryption strength.

### 12. **Identity: AWS Cognito User Pool**

- **Free Tier Limit**: Published Cognito Lite/Essentials free-tier allowances cover up to 10,000–50,000 MAUs depending on account tier; check current pricing before estimating.
- **What's included**: Sign-up, sign-in, token issuance (JWT), user pool storage, group management (`Admin` group), and pre-signup Lambda triggers.
- **Guest accounts**: Each guest scorer creates a shadow Cognito account (`guest-*@cricscore.local`) that counts as 1 MAU per month. Admins can purge stale guest accounts via the authenticated Match Ops Admin Panel (`Purge Guest Accounts`) to keep MAU count near zero.
- **Cost for typical usage**: **$0/month**.

### 13. **ML Inference: S3 Versioned Model Registry & ECR Containerized Lambda (`ml-predict`)**

- **Architecture**: Stores versioned **XGBoost** model bundles (`v2.2.0`, ~227 KB `.joblib` + `model_manifest.json` + `live_metadata.json`) in the existing S3 bucket (`s3://<project>-match-backups-.../models/<version>/`, costing **$0.00** under the 5 GB S3 free tier) and runs the inference engine (`predict.py` + `win_probability.py` Markov DP + DLS resource par) in a Linux x86_64 Lambda container (`1024 MB` RAM, `30s` timeout, lazy-loaded libraries for `<70ms` cold-start `Phase: init`).
- **Inference Latency & Compute Economics**:
  - Warm execution duration is **~1.56 ms** per ball prediction.
  - At 1024 MB (1 GB) memory, 1.56 ms consumes only `0.00156 GB-seconds` per invocation.
  - Under the AWS Lambda permanent free allowance of **400,000 GB-seconds/month**, the platform can execute over **250,000,000 predictions/month completely FREE** before incurring compute charges.
- **ECR Storage & Automated Lifecycle Governance**:
  - Each ECR repository (`cricscoredev-ml-predict` and `cricscore-ml-predict`) enforces an automated `aws_ecr_lifecycle_policy` that expires untagged images after 1 day and retains only the active version tag (`:v2.2.0` + `:latest`), plus immediate untagged image cleanup during `deploy.sh`.
- **On-Demand Retraining (`mlops-pipeline.yml`)**:
  - Retraining in GitHub Actions only triggers when `cricket-data/**` or training scripts (`data_pipeline.py`, `compare_models.py`, `train_model.py`, `requirements-train.txt`) change, on the monthly schedule, or via manual dispatch—saving CI minutes on routine PRs.
- **Client-Side Short-Circuit Optimization (`AiMatchPrediction.tsx`)**:
  - Before the first legal ball is bowled (`ballsBowled === 0 && wickets === 0`), the UI renders an instant `50% - 50%` baseline without invoking Lambda.
  - When a chase is mathematically decided (`runsNeeded <= 0`, `ballsLeft <= 0`, `wickets >= 10`, or `runsNeeded > ballsLeft * 6`), the frontend resolves `100% / 0%` or `0% / 100%` locally without a network round-trip.
- **Total ML Inference Cost**: **$0.00/month**.

---

## 🚫 Strictly Forbidden Paid AWS Resources

To prevent accidental bill shock, the following resources are **strictly prohibited** in `infra/terraform/`:

| Forbidden Resource                                     | Typical Monthly Cost          | Required Zero-Cost Alternative in CricScore                                          |
| :----------------------------------------------------- | :---------------------------- | :----------------------------------------------------------------------------------- |
| **AWS NAT Gateway / VPC Endpoints**                    | **~$32.00+/month** + data     | Run Lambdas outside a VPC using TLS + Cognito JWT + IAM authorization                |
| **CloudWatch Dashboards (`aws_cloudwatch_dashboard`)** | **$3.00/month** per board     | Use auto-generated [`docs/aws_resources_dashboard.md`](./aws_resources_dashboard.md) |
| **KMS Customer-Managed Keys (`aws_kms_key`)**          | **$1.00/month** per key + API | Use AWS-managed encryption (`AES256`, `alias/aws/sns`, `sqs_managed_sse`)            |
| **AWS Secrets Manager**                                | **$0.40/secret/month**        | Inject via Terraform `TF_VAR_*` from `.env.local` / GitHub Environment secrets       |
| **DynamoDB Provisioned Capacity**                      | **Fixed hourly RCU/WCU**      | Always set `billing_mode = "PAY_PER_REQUEST"` on `websocket_connections`             |

---

## 🛡️ Cost Defense & DDoS Guardrails

Because CricScore uses serverless AWS services, unplanned traffic can increase usage and cost. The configured controls below provide traffic and cost safeguards:

1. **API Gateway Throttling**: Both the HTTP and WebSocket API Gateways enforce `default_route_settings` with `throttling_rate_limit = 50` req/sec and `throttling_burst_limit = 100`.
2. **Bounded Lambda Timeouts & Connection Reuse**: All Lambdas have strict timeouts (`10s–30s`) and reuse module-scoped `pg.Pool` connections across warm invocations so hung downstream calls never rack up GB-seconds or exhaust PostgreSQL connections.
3. **AWS Cost Budget (`infra/terraform/budgets.tf`)**: Configures an automated email alert at 100% of a **$5.00 monthly budget** to `var.admin_email`.
4. **Secrets Scanning**: GitLeaks runs in CI and in the local pre-commit hook to prevent credential leaks that could lead to unauthorized cloud spend.

---

## 🗄️ Database (Aiven PostgreSQL)

### 1. **PostgreSQL (Aiven)**

- **Free Tier**: Aiven offers a free-tier for PostgreSQL (1 CPU, 1GB RAM, 1GB Storage).
- **Availability**: Note that Free-tier instances may power-cycle after prolonged inactivity but can be restarted manually. No SLA applies.
- **Lifecycle**: Auto-backups are included.
- **Upgrade Path**: DigitalOcean or AWS-managed RDS starts at ~$15/mo if high-availability is required.

---

## 💸 Detailed Ownership Costs

CricScore is designed for **maximum profitability** on minimal infrastructure. Below is the projected cost of ownership, including a custom domain (starting from **$2.00/year**).

| Duration    | AWS (Free + R53) | Aiven (Free) | Domain ($2/yr) | **Total Cost** |
| :---------- | :--------------- | :----------- | :------------- | :------------- |
| **6 Hours** | $0.003           | $0.00        | $0.001         | **~$0.004**    |
| **1 Day**   | $0.016           | $0.00        | $0.005         | **~$0.021**    |
| **1 Month** | $0.500           | $0.00        | $0.160         | **~$0.660**    |
| **1 Year**  | $6.000           | $0.00        | $2.000         | **~$8.000**    |

_Note: Route 53 Hosted Zone is a fixed $0.50/mo. Domain costs vary ($2+ for .site/.me, ~$12 for .com). KMS CMK cost (~$2/mo) eliminated Sept 2026 by switching to free AWS-managed encryption. CloudWatch Dashboard ($3/mo) eliminated Sept 2026 — removed from Terraform. Cognito User Pool is free for ≤50,000 MAUs/month._

---

## 🏗️ Match Capacity & Scale

For a standard **20-Overs Match** (120 balls per innings = **240 total events/match**), the platform can support the following volume before exceeding the $0 tier.

### 1. **Compute (AWS Lambda / API Gateway)**

- **Limit**: 1,000,000 requests per month.
- **Conversion**: At three Lambda invocations per ball event, 1,000,000 / (240 events × 3) = **~1,388 full matches per month**, before counting other Lambda invocations or charges.
- **Usage**: This is a theoretical estimate using the stated request allowance; actual free usage depends on account eligibility and all other invocations and service charges.

### 2. **Storage (Aiven PostgreSQL)**

- **Limit**: 1.0 GB Storage (Free Tier).
- **Consumption**: One match (including metadata and 240 ball records) consumes ~50KB.
- **Capacity**: 1,000,000 KB / 50 KB = **~20,000 historical matches**.
- **Strategy**: Use the **Admin Panel → Database Cleanup** (or Admin AI Chat) periodically to purge old matches and guest data.

### 3. **Identity (AWS Cognito)**

- **Limit**: 50,000 MAUs/month free.
- **Guest Account Growth**: If guest users are not purged, each guest counts as 1 MAU for the month. With typical usage (10–50 matches/month), guest MAU accumulation is negligible.
- **Recommendation**: Admins should periodically delete stale guest accounts from the Admin Panel to stay well within the free tier.

---

## 🤖 AI API Unit Economics (OpenAI)

The AI Assistant uses native OpenAI models with extreme cost efficiency:

| Resource              | Model                    | Price Rate                            | Average Consumption / Query               | Cost / Action               |
| :-------------------- | :----------------------- | :------------------------------------ | :---------------------------------------- | :-------------------------- |
| **Chat & SQL Agent**  | `gpt-4o-mini`            | $0.15 / 1M input<br>$0.60 / 1M output | ~1,500 input tokens<br>~300 output tokens | **~$0.0004** per query      |
| **Vector Embeddings** | `text-embedding-3-small` | $0.02 / 1M tokens                     | ~15,000 tokens / PDF                      | **~$0.0003** per PDF upload |

### AI Usage Planning

- **Estimated Capacity**: Divide the available provider balance or usage budget by the estimated average cost per action to approximate the number of chat queries or document uploads it can support.
- **Actual Usage**: Costs vary with the selected models, input and output sizes, and provider pricing. Check the provider's usage dashboard to monitor actual spend.

---

## 📉 Cost Optimization Tips

1.  **Match Lifecycle Management**: Set a matches `status` to `COMPLETED` to stop unnecessary WebSocket polling.
2.  **Log Retention**: Configure CloudWatch logs for 7-day retention to avoid storage creep.
3.  **Domain Selection**: Use low-cost TLDs (like `.site` or `.me`) via registrars like **Spaceship** or **Porkbun** to keep your yearly overhead under **$2.00**.
4.  **Review Backup Storage**: Frontend S3 bucket versioning is enabled; DynamoDB point-in-time recovery is not configured in the current Terraform. Review retained versions and backups for storage costs.
5.  **Avoid Customer Managed KMS Keys (CMKs)**: Each CMK costs $1.00/month regardless of usage. Use free AWS-managed alternatives: `AES256` for S3, `alias/aws/sns` for SNS, `sqs_managed_sse_enabled` for SQS.
6.  **Purge Guest Cognito Accounts**: Guest shadow accounts (`guest-*@cricscore.local`) each count as 1 Cognito MAU/month. Use the Match Ops Admin Panel (`Purge Guest Accounts`) to remove stale accounts before they accumulate.
7.  **Match Backup Size**: S3 match backup snapshots are small (~5–15KB each) but grow over time. The Admin Panel cleanup also removes match records; pair it with periodic S3 lifecycle rules if needed.

## ⚖️ Total Monthly Estimated Cost Breakdown

| Component                         | Service Provider         |    Monthly Cost    | Free-Tier Allowance / Details                                                 |
| --------------------------------- | ------------------------ | :----------------: | ----------------------------------------------------------------------------- |
| **Serverless Compute**            | AWS Lambda (9 functions) |     **$0.00**      | 1M free requests + 400,000 GB-seconds/mo (covers ~1,388 full matches)         |
| **Real-Time WebSockets**          | AWS API Gateway          |     **$0.00**      | 1M free messages + 750,000 connection minutes/mo                              |
| **Relational Database & Vectors** | Aiven PostgreSQL 16      |     **$0.00**      | Free tier includes 1 CPU, 1GB RAM, 1GB disk with `pgvector` (~20,000 matches) |
| **Static App Hosting & CDN**      | AWS S3 & CloudFront      |     **$0.00**      | S3: 5GB free storage; CloudFront: 1TB free data transfer out/mo               |
| **WebSocket Connection Tracking** | AWS DynamoDB             |     **$0.00**      | Pay-Per-Request with 25GB free storage & 2.5M reads/writes                    |
| **Event Fan-Out & Buffering**     | AWS SNS & SQS FIFO       |     **$0.00**      | 1M free publishes/mo; SQS FIFO buffer handles live score surges               |
| **Container Image Registry**      | AWS ECR (`ml-predict`)   |     **$0.00**      | 500 MB free private repository storage/mo (image is ~240MB)                   |
| **User Identity & Auth**          | AWS Cognito User Pool    |     **$0.00**      | Free for ≤50,000 MAUs/month (both regular and guest users)                    |
| **Observability & Logs**          | AWS CloudWatch & X-Ray   |     **$0.00**      | 5GB free log ingestion (7-day retention) + 100k free X-Ray traces             |
| **Match PDF Email Reports**       | AWS SES                  |     **$0.00**      | 62,000 free emails/mo when sent from Lambda                                   |
| **MLOps Pipeline & Registry**     | Local Git, DVC & MLflow  |     **$0.00**      | Zero cloud tracking fees (runs locally in `.venv` and GitHub Actions)         |
| **DNS Routing**                   | AWS Route 53 Hosted Zone |     **$0.50**      | Fixed $0.50/month per hosted zone for custom domain routing                   |
| **Custom Domain Registration**    | Spaceship / Porkbun      |     **~$0.16**     | Amortized (~$2.00/year for `.site` / `.me`, ~$10/yr for `.com`)               |
| **AI Chat & SQL Agent**           | OpenAI (`gpt-4o-mini`)   |     **~$0.40**     | Pay-as-you-go (~$0.0004 per query; ~$0.40 per 1,000 questions)                |
| **TOTAL MONTHLY OPERATING COST**  |                          | **~$1.06 / month** | **Complete production platform for ~$1/month**                                |
