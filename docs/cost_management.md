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

### 4. **Delivery: CloudFront & Route 53**
*   **CloudFront**: First 1TB of data transfer out is **FREE**. Effectively $0 for this app's payload.
*   **Route 53**: Hosting a custom domain (e.g., `cricscore.venkateshsingamsetty.site`) incurs a fixed cost of **$0.50 per month** per hosted zone + domain registration fees.

### 5. **Reporting: AWS SES (Email)**
*   **Cost**: First 62,000 emails per month are **FREE** when sent from AWS Lambda. 
*   **Usage**: Each match conclusion triggers 1 auto-email to fans/admins. Even with extreme usage (1,000 matches), this remains well within the $0 cost tier.

---

## 🗄️ Database & Kafka (Aiven)

### 1. **PostgreSQL (Aiven)**
*   **Free Tier**: Aiven offers a free-tier for PostgreSQL (1 CPU, 1GB RAM, 1GB Storage).
*   **Availability**: Note that Free-tier instances may power-cycle after prolonged inactivity but can be restarted manually. No SLA applies.
*   **Lifecycle**: Auto-backups are included. 
*   **Upgrade Path**: DigitalOcean or AWS-managed RDS starts at ~$15/mo if high-availability is required.

### 2. **Kafka (Aiven)**
*   **Free Tier / Startup Plan**: Aiven provides a standard startup plan for Kafka. For low-throughput cricket updates, the entry-level plan (~$0.01/hr or dedicated free tiers where available) is sufficient.
*   **Optimization**: We use mTLS to keep traffic secure without the cost of a VPC Private Link.

---

## 💸 Detailed Ownership Costs (v2.0)

CricScore is designed for **maximum profitability** on minimal infrastructure. Below is the projected cost of ownership, including a custom domain (starting from **$2.00/year**).

| Duration | AWS (Free + R53) | Aiven (Free) | Domain ($2/yr) | **Total Cost** |
| :--- | :--- | :--- | :--- | :--- |
| **6 Hours** | $0.003 | $0.00 | $0.001 | **~$0.004** |
| **1 Day** | $0.016 | $0.00 | $0.005 | **~$0.021** |
| **1 Month** | $0.500 | $0.00 | $0.160 | **~$0.660** |
| **1 Year** | $6.000 | $0.00 | $2.000 | **~$8.000** |

*Note: Route 53 Hosted Zone is a fixed $0.50/mo. Domain costs vary ($2+ for .site/.me, ~$12 for .com).*

---

## 🏗️ Match Capacity & Scale (v2.0)

For a standard **20-Overs Match** (120 balls per innings = **240 total events/match**), the platform can support the following volume before exceeding the $0 tier.

### 1. **Compute (AWS Lambda & Messaging Hub)**
- **Limit**: 1,000,000 requests per month.
- **The Multiplier**: 1 Ball = 3 Lambda Requests + 3 SNS Actions. (Effectively 720 compute-actions per match).
- **Conversion**: 1,000,000 / 720 = **~1,388 full matches per month**.
- **Usage**: You can host approximately **45 full matches per day for free**.

### 2. **Storage (Aiven PostgreSQL)**
- **Limit**: 1.0 GB Storage (Free Tier).
- **Consumption**: One match (including metadata and 240 ball records) consumes ~50KB.
- **Capacity**: 1,000,000 KB / 50 KB = **~20,000 historical matches**.
- **Strategy**: Use the **Admin Global Purge** periodically to maintain this archive.

### 3. **Messaging (Aiven Kafka)**
- **Limit**: 5.0 GB Storage (Free Tier).
- **Usage**: Kafka topics use **Time-Based Retention** (e.g., 24 hours). Storage is recycled daily, allowing for practically **unlimited matches** as long as concurrent traffic stays within the MB/s bandwidth limits.

---

## 📉 Cost Optimization Tips

1.  **Match Lifecycle Management**: Set a matches `status` to `COMPLETED` to stop unnecessary WebSocket polling.
2.  **Log Retention**: Configure CloudWatch logs for 7-day retention to avoid storage creep.
3.  **Domain Selection**: Use low-cost TLDs (like `.site` or `.me`) to keep your yearly overhead under **$2.00**.

## ⚖️ Total Monthly Estimated Cost
- **Small-to-Medium Tournaments**: **~$0.66** (Route 53 + Amortized Domain Registration).
- **Large-scale Public Launch**: **$10.00 - $25.00** (Only if upgrading to non-free Aiven Kafka or if you require high-availability RDS).
