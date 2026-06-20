# 💰 Cloud Cost & Infrastructure Management

This document provides a breakdown of the estimated operational costs for the CricScore platform. The architecture is designed to stay within **Free Tier** limits for small-to-medium deployments.

## 🏗️ AWS Infrastructure (US-East-1 Estimates)

### 1. **Compute: AWS Lambda**
*   **Free Tier Limit**: 1,000,000 Requests AND 400,000 GB-Seconds per month.
*   **The Fan-Out Multiplier (3x)**: Every single ball event (1 click) triggers **3 Lambda invocations** (`score-update` -> `broadcaster` -> `storage-worker`). 
*   **Est. Max Load**: 1M requests / 3 lambdas = 333,333 ball events = **~1,350 Matches per month** remaining at absolutely $0 cost.
*   **Memory Optimization**: We upgraded lambdas to **256MB RAM** (consuming 2x GB-Seconds but preventing CPU throttling on the mTLS / PostgreSQL handshakes).

### 2. **Real-time: WebSocket API Gateway**
*   **Free Tier Limit**: 1,000,000 Messages + 750,000 Connection Minutes per month.
*   **Cost After Tier**: $1.00 per 1M messages.
*   **Multiplier (`X`)**: For every 1 ball scored, API Gateway pushes **`X` messages** (Where `X` is the number of active, live spectators). If 100 fans watch 1 over (6 balls), it costs 600 messages. 

### 3. **Messaging & Buffering (AWS SNS & SQS)**
*   **SNS (Fan-Out Hub)**: First 1,000,000 Publishes + 100,000 HTTP Deliveries per month are **FREE**.
*   **SQS (Reliability Buffer)**: First 1,000,000 Standard Requests per month are **FREE**.
*   **The Multiplier**: 1 Ball = 1 SNS Publish + 2 SNS Deliveries (Lambda + SQS) + 1 SQS Write.
*   **Est. Usage**: 300,000 ball events comfortably fit within these limits.

### 4. **Storage: Amazon S3 & DynamoDB**
*   **S3**: First 5GB of Standard Storage + 20,000 GET requests per month are **FREE**. (The React app is ~5MB).
*   **DynamoDB**: 25GB of Storage + 2.5 Million Read/Write capacity per month. (Spectator connection tracking is negligible).

### 5. **Delivery: CloudFront & Route 53**
*   **CloudFront**: First 1TB of data transfer out is **FREE**. Effectively $0 for this app's payload.
*   **Route 53**: Hosting a custom domain (e.g., `cricscore.example.com`) incurs a fixed cost of **$0.50 per month** per hosted zone + domain registration fees.

### 6. **Reporting: AWS SES (Email)**
*   **Cost**: First 62,000 emails per month are **FREE** when sent from AWS Lambda. 
*   **Usage**: Each match conclusion triggers 1 auto-email to fans/admins. Even with extreme usage (1,000 matches), this remains well within the $0 cost tier.

---

## 🗄️ Database (Aiven PostgreSQL)

### 1. **PostgreSQL (Aiven)**
*   **Free Tier**: Aiven offers a free-tier for PostgreSQL (1 CPU, 1GB RAM, 1GB Storage).
*   **Availability**: Note that Free-tier instances may power-cycle after prolonged inactivity but can be restarted manually. No SLA applies.
*   **Lifecycle**: Auto-backups are included. 
*   **Upgrade Path**: DigitalOcean or AWS-managed RDS starts at ~$15/mo if high-availability is required.

---

## 💸 Detailed Ownership Costs

CricScore is designed for **maximum profitability** on minimal infrastructure. Below is the projected cost of ownership, including a custom domain (starting from **$2.00/year**).

| Duration | AWS (Free + R53) | Aiven (Free) | Domain ($2/yr) | **Total Cost** |
| :--- | :--- | :--- | :--- | :--- |
| **6 Hours** | $0.003 | $0.00 | $0.001 | **~$0.004** |
| **1 Day** | $0.016 | $0.00 | $0.005 | **~$0.021** |
| **1 Month** | $0.500 | $0.00 | $0.160 | **~$0.660** |
| **1 Year** | $6.000 | $0.00 | $2.000 | **~$8.000** |

*Note: Route 53 Hosted Zone is a fixed $0.50/mo. Domain costs vary ($2+ for .site/.me, ~$12 for .com).*

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
- **Strategy**: Use the **Admin Global Purge** periodically to maintain this archive.

---

## 📉 Cost Optimization Tips

1.  **Match Lifecycle Management**: Set a matches `status` to `COMPLETED` to stop unnecessary WebSocket polling.
2.  **Log Retention**: Configure CloudWatch logs for 7-day retention to avoid storage creep.
3.  **Domain Selection**: Use low-cost TLDs (like `.site` or `.me`) to keep your yearly overhead under **$2.00**.
4.  **Strict Zero-Cost Infrastructure**: We have explicitly disabled **S3 Versioning** and **DynamoDB Point-in-Time Recovery (PITR)** across the Terraform stack to guarantee $0 hidden backup costs.

## ⚖️ Total Monthly Estimated Cost
- **Small-to-Medium Tournaments**: **~$0.66** (Route 53 + Amortized Domain Registration).
- **Large-scale Public Launch**: **$10.00 - $25.00** (Only if you require high-availability RDS).
