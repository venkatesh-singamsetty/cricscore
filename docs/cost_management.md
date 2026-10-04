# 💰 Cloud Cost & Infrastructure Management

This document provides a breakdown of the estimated operational costs for the CricScore platform. The architecture is designed to stay within **Free Tier** limits for small-to-medium deployments.

## 🏗️ AWS Infrastructure (US-East-1 Estimates)

### 1. **Compute: AWS Lambda**

- **Free Tier Limit**: 1,000,000 Requests AND 400,000 GB-Seconds per month.
- **The Fan-Out Multiplier (3x)**: Every single ball event (1 click) triggers **3 Lambda invocations** (`score-update` -> `broadcaster` -> `storage-worker`).
- **Cognito Pre-Signup Lambda**: A lightweight `cognito-presignup` Lambda is invoked on each new user registration. Guest accounts (`guest-*@cricscore.local`) auto-confirm; normal accounts go through standard Cognito email verification. This is negligible — well within free tier.
- **Est. Max Load**: 1M requests / 3 lambdas = 333,333 ball events = **~1,350 Matches per month** remaining at absolutely $0 cost.
- **Memory Optimization**: Core routing lambdas run at **256MB RAM** (preventing CPU throttling on PostgreSQL handshakes). The AI `chat-api` runs at **1024MB RAM** to handle heavy `pdf-parse` operations. Because AWS bills by GB-seconds, running the 1024MB container for 2 seconds is cheaper than thrashing a 128MB container for 30 seconds.

### 2. **Real-time: WebSocket API Gateway**

- **Free Tier Limit**: 1,000,000 Messages + 750,000 Connection Minutes per month.
- **Cost After Tier**: $1.00 per 1M messages.
- **Multiplier (`X`)**: For every 1 ball scored, API Gateway pushes **`X` messages** (Where `X` is the number of active, live spectators). If 100 fans watch 1 over (6 balls), it costs 600 messages.

### 3. **Messaging & Buffering (AWS SNS & SQS)**

- **SNS (Fan-Out Hub)**: First 1,000,000 Publishes + 100,000 HTTP Deliveries per month are **FREE**.
- **SQS (Reliability Buffer)**: First 1,000,000 Standard Requests per month are **FREE**.
- **The Multiplier**: 1 Ball = 1 SNS Publish + 2 SNS Deliveries (Lambda + SQS) + 1 SQS Write.
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
- **Usage**: A strict 5% Sampling Rule is enforced in `infra/terraform/xray.tf`. Even at 1,000,000 API requests, we will only trace ~50,000 requests, guaranteeing $0/month cost.

### 9. **CloudWatch Dashboard** _(removed — paid)_

- **Cost**: **$3.00/month** per dashboard. No free tier.
- **Decision**: The Terraform-provisioned `aws_cloudwatch_dashboard` (Mission Control) was removed in Sept 2026 to maintain a strict $0 observability footprint.
- **Alternative**: All the same metrics (Lambda errors, API traffic, SQS depth) are still accessible individually in the [CloudWatch Metrics console](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#metricsV2) at no cost — just not aggregated into a single screen.
- **Saving**: **$3.00/month** eliminated.

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

- **Free Tier Limit**: **50,000 Monthly Active Users (MAUs)** per month, permanently free.
- **What's included**: Sign-up, sign-in, token issuance (JWT), user pool storage, group management (`Admin` group), and pre-signup Lambda triggers.
- **Guest accounts**: Each guest scorer creates a shadow Cognito account (`guest-*@cricscore.local`) that counts as 1 MAU per month. Admins can purge stale guest accounts via the Admin Panel or AI Chat to keep MAU count low.
- **After free tier**: $0.0055 per MAU (e.g., 100,000 MAUs = $275/mo). For a small tournament platform this threshold is extremely unlikely to be reached.
- **Cost for typical usage**: **$0/month**.

### 13. **ML Inference: AWS ECR & Containerized Lambda** _(new)_

- **Free Tier Limit**: **500MB of Private ECR Storage** per month, permanently free. Containerized Lambdas share the standard 1,000,000 free requests per month.
- **Usage**: The XGBoost Machine Learning model (`ml-engine`) requires heavy dependencies like Pandas and Scikit-Learn that exceed the 250MB Lambda zip limit. By packaging it as a Docker image and deploying it via ECR, we bypass the zip limit entirely (Docker images support up to 10GB).
- **Cost Efficiency**: AWS charges the **exact same price** for a Docker-based Lambda as a zip-based Lambda. By disabling ECR image scanning (which incurs a fee) in Terraform, the entire ML infrastructure remains at **$0/month**.

---

## 🛡️ Cost Defense & DDoS Guardrails

Because CricScore is a fully serverless platform on the AWS Free Tier, it is critically important to prevent malicious traffic (e.g., DDoS attacks or scrapers) from triggering runaway auto-scaling and incurring unexpected bills. The infrastructure enforces the following strict limits:

1. **API Gateway Rate Limiting**: Both the HTTP and WebSocket API Gateways have `default_route_settings` enabled with a `throttling_rate_limit = 50` and `throttling_burst_limit = 100`. This instantly drops abusive traffic before it reaches AWS Lambda.
2. **Lambda Concurrency Caps**: Every single AWS Lambda function is hard-capped with `reserved_concurrent_executions = 20`. This ensures that even during a massive traffic spike, AWS will throttle the traffic instead of auto-scaling to thousands of instances. This specifically protects the Aiven Free Tier PostgreSQL database (which has a hard limit of ~25 connections) from crashing under heavy load.
3. **Automated AWS Cost Budgets**: Terraform automatically provisions a `aws_budgets_budget` resource that monitors your account daily. If your projected or actual monthly spend ever exceeds **$5.00**, it will instantly fire an email alert to the `admin_email` specified in your Terraform variables.
4. **Automated Secrets Scanning**: The CI/CD pipeline and the Git history are continuously monitored by **GitLeaks** to ensure that OpenAI/OpenRouter keys and AWS credentials are never accidentally leaked to the public, which prevents automated crypto-mining bots from hijacking the account.

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
- **Conversion**: 1,000,000 / 240 = **~4,166 full matches per month**.
- **Usage**: You can host over **130 matches per day for free**.

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

### Balance Utilization ($4.50 OpenAI Credit):

- **Chat Capacity**: ~$4.50 / $0.0004 = **~11,250 chat queries**.
- **Rulebook Upload Capacity**: ~$4.50 / $0.0003 = **~15,000 PDF uploads**.

---

## 📉 Cost Optimization Tips

1.  **Match Lifecycle Management**: Set a matches `status` to `COMPLETED` to stop unnecessary WebSocket polling.
2.  **Log Retention**: Configure CloudWatch logs for 7-day retention to avoid storage creep.
3.  **Domain Selection**: Use low-cost TLDs (like `.site` or `.me`) via registrars like **Spaceship** or **Porkbun** to keep your yearly overhead under **$2.00**.
4.  **Strict Zero-Cost Infrastructure**: We have explicitly disabled **S3 Versioning** and **DynamoDB Point-in-Time Recovery (PITR)** across the Terraform stack to guarantee $0 hidden backup costs.
5.  **Avoid Customer Managed KMS Keys (CMKs)**: Each CMK costs $1.00/month regardless of usage. Use free AWS-managed alternatives: `AES256` for S3, `alias/aws/sns` for SNS, `sqs_managed_sse_enabled` for SQS.
6.  **Purge Guest Cognito Accounts**: Guest shadow accounts (`guest-*@cricscore.local`) each count as 1 Cognito MAU/month. Use the Admin Panel or AI Chat (`delete all guest users`) to remove stale accounts before they accumulate.
7.  **Match Backup Size**: S3 match backup snapshots are small (~5–15KB each) but grow over time. The Admin Panel cleanup also removes match records; pair it with periodic S3 lifecycle rules if needed.

## ⚖️ Total Monthly Estimated Cost

- **Small-to-Medium Tournaments**: **~$0.66** (Route 53 + Amortized Domain Registration).
- **AI Chatbot Usage**: **~$0.40** per 1,000 user questions (billed directly by OpenAI).
- **Large-scale Public Launch**: **$10.00 - $25.00** (Only if you require high-availability RDS).
- **Cognito**: **$0/month** for ≤50,000 MAUs. Scales to ~$275/mo at 100,000 MAUs (enterprise territory).
