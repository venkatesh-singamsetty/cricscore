# 💰 Cloud Cost & Infrastructure Management

This document provides a breakdown of the estimated operational costs for the CricScore platform. The architecture is designed to stay within **Free Tier** limits for small-to-medium deployments.

## 🏗️ AWS Infrastructure (US-East-1 Estimates)

### 1. **Compute: AWS Lambda**
*   **Cost**: First 1 Million requests per month are **FREE**.
*   **Usage**: Each ball scored triggers ~1-2 lambda executions. For a typical match (20 overs = 120 balls), that's ~250 requests. 
*   **Est. Max Load**: You can host ~4,000 matches per month for $0 compute cost.

### 2. **Real-time: WebSocket API Gateway**
*   **Cost**: $1.00 per million messages (after free tier).
*   **Free Tier**: 1 million messages + 750,000 connection minutes per month are **FREE**.
*   **Est. Usage**: High fan counts (100+ fans per match) consume messages quickly, but standard usage remains free.

### 3. **Storage: Amazon S3 & DynamoDB**
*   **S3**: First 5GB is **FREE**. (The React app is ~5MB).
*   **DynamoDB**: 25GB of storage is **FREE**. (Connection tracking is negligible).

### 4. **Delivery: CloudFront**
*   **Cost**: First 1TB of data transfer out is **FREE**.
*   **Usage**: Unless you are serving millions of images (unlikely), this is effectively $0.

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

## 📉 Cost Optimization Tips

1.  **Match Lifecycle Management**:
    *   Set a matches `status` to `COMPLETED` when finished to stop unnecessary WebSocket polling.
2.  **Log Retention**:
    *   Configure CloudWatch logs for 7-day retention to avoid storage creep.
3.  **Kafka Compaction**:
    *   Ensure the `score-updates` topic has a retention policy (e.g., 24 hours), as we persist permanent ball data in PostgreSQL anyway.

## ⚖️ Total Monthly Estimated Cost
*   **Development / Small Tournaments**: **$0.00** (Strictly within Free Tiers).
*   **Large-scale Public Launch**: **$5.00 - $15.00** (Primarily for a non-free Kafka/DB instance if needed).
