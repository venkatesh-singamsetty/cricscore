# 💰 Cloud Cost & Infrastructure Management

This document provides estimated operational costs for the CricScore platform. Free-tier eligibility, allowances, and service pricing vary; treat the figures below as estimates and check the current AWS pricing for your account, region, and deployment.

## 🏗️ AWS Infrastructure (US-East-1 Estimates)

### 1. **Compute: AWS Lambda**

- **Free Tier Limit**: 1,000,000 Requests AND 400,000 GB-Seconds per month.
- **The Fan-Out Multiplier (3x)**: Every single ball event (1 click) triggers **3 Lambda invocations** (`score-update` -> `broadcaster` -> `storage-worker`).
- **Cognito Pre-Signup Lambda**: A lightweight `cognito-presignup` Lambda is invoked on each new user registration. Guest accounts (`guest-*@cricscore.local`) auto-confirm; normal accounts go through standard Cognito email verification. This is negligible — well within free tier.
- **Est. Max Load**: 1M requests / 3 lambdas = 333,333 ball events = **~1,350 Matches per month** remaining at absolutely $0 cost.
- **Memory Configuration**: ZIP-based functions default to **128MB** unless configured otherwise; `score-update` uses **256MB** and `chat-api` uses **1024MB**. The prediction Lambda uses **512MB**. Actual cost depends on each function's configured memory and execution duration.

### 2. **Real-time: WebSocket API Gateway**

- **Free Tier Limit**: 1,000,000 Messages + 750,000 Connection Minutes per month.
- **Cost After Tier**: $1.00 per 1M messages.
- **Multiplier (`X`)**: For every 1 ball scored, API Gateway pushes **`X` messages** (Where `X` is the number of active, live spectators). If 100 fans watch 1 over (6 balls), it costs 600 messages.

### 3. **Messaging & Buffering (AWS SNS & SQS)**

- **SNS (Fan-Out Hub)**: First 1,000,000 Publishes + 100,000 HTTP Deliveries per month are **FREE**.
- **SQS (Reliability Buffer)**: The configured queue is FIFO, so do not apply the Standard SQS free-request allowance to its requests. Check current FIFO pricing and free-tier eligibility.
- **The Multiplier**: A score update sends one SNS publish and one direct SQS message. The SNS topic has a Lambda subscription for the broadcaster; SQS is not an SNS subscription in the current Terraform.
- **Est. Usage**: 300,000 ball events comfortably fit within these limits.
- **Encryption**: SNS uses `alias/aws/sns` (AWS-managed, **free**). SQS uses `sqs_managed_sse_enabled` (**free**).

### 4. **Storage: Amazon S3 & DynamoDB**

- **S3 (App Hosting)**: First 5GB of Standard Storage + 20,000 GET requests per month are **FREE**. (The React app is ~5MB).
- **S3 Encryption**: Uses SSE-S3 (`AES256`) — AWS-managed, **$0/month**.
- **S3 Match Backups** _(new)_: A dedicated `match-backups` bucket stores JSON snapshots of completed matches at the time of email report generation (triggered by `POST /match/{id}/email`). Each snapshot is ~5–15KB. 1,000 matches ≈ **15MB total** — well within the 5GB free tier. **Cost: $0/month**.
- **DynamoDB**: 25GB of Storage + 2.5 Million Read/Write capacity per month. (Spectator connection tracking is negligible).

### 5. **Delivery: CloudFront & Route 53**

- **CloudFront**: First 1TB of data transfer out is **FREE**. Effectively $0 for this app's payload.
- **Route 53**: Hosting a custom domain (e.g., `cricscore.example.com`) incurs a fixed cost of **$0.50 per month** per hosted zone + domain registration fees.

### 6. **Reporting: AWS SES (Email)**

- **Cost**: First 62,000 emails per month are **FREE** when sent from AWS Lambda.
- **Usage**: Each match conclusion triggers 1 auto-email to fans/admins. Even with extreme usage (1,000 matches), this remains well within the $0 cost tier.

### 7. **Monitoring: AWS CloudWatch Alarms**

- **Cost**: First **10 alarms** per month are **FREE**.
- **Usage**: The platform provisions 2 alarms (`match-api-errors`, `score-update-errors`). **$0/month**.
- **Includes SNS email alerts** — SNS topic and email subscription are both within the SNS free tier.

### 8. **Distributed Tracing: AWS X-Ray**

- **Cost**: First 100,000 traces recorded per month are **FREE**.
- **Usage**: The sampling rule in `infra/terraform/xray.tf` has a 5% fixed rate and a one-request-per-second reservoir. Actual trace volume depends on traffic and sampling behavior; it is not guaranteed to equal 5% of requests.

### 9. **CloudWatch Dashboard** _(removed — paid)_

- **Cost**: **$3.00/month** per dashboard. No free tier.
- **Decision**: The current Terraform configuration does not provision an `aws_cloudwatch_dashboard`, avoiding the dashboard charge where applicable.
- **Alternative**: Metrics such as Lambda errors, API traffic, and SQS depth can be inspected individually in the [CloudWatch Metrics console](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#metricsV2); costs may still apply for other observability usage.
- **Saving**: Avoids any applicable recurring dashboard charge.

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

### 12. **Identity: AWS Cognito User Pool** _(new)_

- **Free Tier Limit**: Published Cognito free-tier allowances depend on plan and account eligibility; check current pricing before estimating.
- **What's included**: Sign-up, sign-in, token issuance (JWT), user pool storage, group management (`Admin` group), and pre-signup Lambda triggers.
- **Guest accounts**: Each guest scorer creates a shadow Cognito account (`guest-*@cricscore.local`) that counts as 1 MAU per month. Admins can purge stale guest accounts via the Admin Panel or AI Chat to keep MAU count low.
- **After free tier**: $0.0055 per MAU (e.g., 100,000 MAUs = $275/mo). For a small tournament platform this threshold is extremely unlikely to be reached.
- **Cost for typical usage**: **$0/month**.

### 13. **ML Inference: AWS ECR & Containerized Lambda** _(new)_

- **Free Tier Limit**: ECR storage allowances and eligibility vary; check current pricing for the account and region. Containerized Lambdas use Lambda's normal invocation and compute pricing.
- **Usage**: The Scikit-Learn Logistic Regression model (`ml-engine`) and its dependencies are packaged as a Lambda container image in ECR. Container images support up to 10GB.
- **Cost**: Lambda execution, ECR image storage, and image transfer can incur charges; disabling ECR image scanning does not make the full inference deployment free.

---

## 🛡️ Cost Defense & DDoS Guardrails

Because CricScore uses serverless AWS services, unplanned traffic can increase usage and cost. The configured controls below provide some traffic and cost safeguards, but do not prevent all DDoS activity or guarantee a maximum bill:

1. **API Gateway Throttling**: Both the HTTP and WebSocket API Gateways have `default_route_settings` with a `throttling_rate_limit = 50` and `throttling_burst_limit = 100`. Requests exceeding these limits can be throttled before invoking the backend; this is not comprehensive DDoS protection.
2. **Lambda Concurrency**: This Terraform configuration does not set a reserved concurrency cap. Any account-level concurrency quota depends on the AWS account and region; do not rely on it as a database protection or cost limit.
3. **AWS Cost Budget**: Terraform configures an actual-cost email notification at 100% of a **$5.00 monthly budget**. Notifications can be delayed and are not a spending cap; no projected-cost alert is configured here.
4. **Secrets Scanning**: GitLeaks runs in CI, and the local pre-commit hook scans staged files when GitLeaks is installed. These checks reduce risk but cannot guarantee that secrets have never been exposed.

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
6.  **Purge Guest Cognito Accounts**: Guest shadow accounts (`guest-*@cricscore.local`) each count as 1 Cognito MAU/month. Use the Admin Panel or AI Chat (`delete all guest users`) to remove stale accounts before they accumulate.
7.  **Match Backup Size**: S3 match backup snapshots are small (~5–15KB each) but grow over time. The Admin Panel cleanup also removes match records; pair it with periodic S3 lifecycle rules if needed.

## ⚖️ Total Monthly Estimated Cost

- **Small-to-Medium Tournaments**: **~$0.66** (Route 53 + Amortized Domain Registration).
- **AI Chatbot Usage**: **~$0.40** per 1,000 user questions (billed directly by OpenAI).
- **Large-scale Public Launch**: **$10.00 - $25.00** (Only if you require high-availability RDS).
- **Cognito**: **$0/month** for ≤50,000 MAUs. Scales to ~$275/mo at 100,000 MAUs (enterprise territory).
