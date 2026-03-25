# 🏗️ Infrastructure: Aiven & AWS Stack

CricScore is a cross-cloud application leveraging **Aiven Lifecycle Management** and **AWS Serverless compute**.

---

## 🛠️ Aiven Managed Data Services (Free Tier)

### 1. **PostgreSQL**
**Service**: `cricscore-db`
- **Use Case**: Master system of record for matches, teams, and ball histories. 
- **Security**: SSL Mode `require`.
- **Primary Table**: `ball_events` (ID, Inning, Runs, Wickets, Commentary).

### 2. **Apache Kafka**
**Service**: `cricscore-kafka`
- **Use Case**: Real-time event bus for match scoring.
- **Authentication**: **mTLS (Mutual TLS)** using Client Certificates.
- **Topic**: `score-updates` (Min ISR: 1, Retention: 24h).
- **Port**: **17729** (Direct SSL connection).

---

## 🌩️ AWS Serverless Stack

### 1. **Computing**
- **Lambdas**:
    - `match-api`: Handles HTTP match CRUD.
    - `score-update`: Dual-write producer (Postgres/Kafka).
    - `kafka-consumer/broadcaster`: WebSocket broadcaster.
    - `onconnect/ondisconnect`: Session managers.

### 2. **Routing & Delivery**
- **API Gateway (HTTP)**: High-performance endpoint for Scorer input.
- **API Gateway (WebSocket)**: Persistent bi-directional tunnel for Real-time apps.
- **CloudFront**: Edge delivery for the frontend assets (S3 Static Website).
- **AWS SES (SES)**: Automated "Fancy" HTML email engine for post-match reports. (Requires verified email identity).

---

## 📝 Configuration (IaC)
Infrastructure is managed with **Terraform**. 
- **Secret Management**: Handled via `terraform.tfvars` (Git Ignored).
- **Secure Certificate Handling**: Aiven Kafka certificates are injected as **Base64-encoded environment variables** (`KAFKA_CA_CERT`, `KAFKA_ACCESS_CERT`, `KAFKA_ACCESS_KEY`), keeping the repository free of physical `.pem` files.
- **Package Management**: Lambda functions are archived on-the-fly during `terraform apply`.
- **Variables**: Root `terraform/variables.tf`.
