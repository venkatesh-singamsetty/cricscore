# 💰 Cloud Cost & Infrastructure Management

This document provides a breakdown of the estimated operational costs for the CricScore platform. The architecture is designed to stay within **Free Tier** limits for small-to-medium deployments.

## 🏗️ AWS Infrastructure (US-East-1 Estimates)

### 1. **Compute: AWS Lambda**
*   **Cost**: First 1 Million requests per month are **FREE**.
*   **Memory Optimization**: We upgraded the `score-updates` lambda to **256MB RAM**. While this technically costs 2x more per millisecond than the 128MB tier, the increased CPU power handles the **mTLS (Kafka) and SSL (Postgres) handshakes** significantly faster, reducing total billable duration and preventing timeouts.
*   **Est. Max Load**: You can host ~4,000 matches per month for $0 compute cost.

### 2. **Real-time: WebSocket API Gateway**
*   **Cost**: $1.00 per million messages (after free tier).
*   **Free Tier**: 1 million messages + 750,000 connection minutes per month are **FREE**.
*   **Est. Usage**: High fan counts (100+ fans per match) consume messages quickly, but standard usage remains free.

### 3. **Messaging & Buffering (AWS SNS & SQS)**
*   **SNS (Fan-Out Hub)**: First 1 Million requests per month are **FREE**.
*   **SQS (Reliability Buffer)**: First 1 Million requests per month are **FREE**.
*   **Est. Usage**: Even with 4,000 matches (240 balls each), the messaging infrastructure operates entirely within the $0 tier.

### 4. **Storage: Amazon S3 & DynamoDB**
*   **S3**: First 5GB is **FREE**. (The React app is ~5MB).
*   **DynamoDB**: 25GB of storage is **FREE**. (Connection tracking is negligible).

### 4. **Delivery: CloudFront & Route 53**
*   **CloudFront**: First 1TB of data transfer out is **FREE**. Effectively $0 for this app's payload.
*   **Route 53**: Hosting a custom domain (e.g., `cricscore.venkateshsingamsetty.site`) incurs a fixed cost of **$0.50 per month** per hosted zone + domain registration fees.

### 5. **Reporting: AWS SES (Email)**
*   **Cost**: First 62,000 emails per month are **FREE** when sent from AWS Lambda. 
*   **Usage**: Each match conclusion triggers 1 auto-email to fans/admins. Even with extreme usage (1,000 matches), this remains well within the $0 cost tier.

---

## 🗄️ Database & Kafka (Aiven)

### 1. **PostgreSQL (Aiven)**
*   **Free Tier**: Aiven offers a free-tier for PostgreSQL (1 CPU, 2GB RAM, 5GB Storage).
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

### 1. **Compute (AWS Lambda / API Gateway)**
- **Limit**: 1,000,000 requests per month.
- **Conversion**: 1,000,000 / 240 = **~4,166 full matches per month**.
- **Usage**: You can host over **130 matches per day for free**.

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
