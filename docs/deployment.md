# 🚀 Deployment: End-to-End Infrastructure Guide

This guide covers the 3-phase journey from **Local Development** to **Professional Cloud Production**. 

---

## 🏗️ Phase 0: Local Lifecycle Preview
Test the **v2.0 Fan-Out** frontend engine locally against the production cloud backend.

### **Prerequisites**
- **Node.js**: Version **18.x or higher**.
- **npm**: Included with Node.js.
- **Git**: To clone the repository.

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/venkatesh-singamsetty/cric-score.git
    cd cric-score && npm install
    ```
2.  **Initialize Environment**:
    ```bash
    cp .env.example .env
    npm run dev
    ```

---

## 🛡️ Phase 1: Bootstrap Governance (Managed Infrastructure)
These resources are managed separately to ensure **Persistence and Cost Efficiency**. Create these **once** and **do not** include them in your application `terraform destroy` cycles.

### **Critical Governance**
- **Cost (Route 53)**: Avoid redundant **$0.50/mo** Hosted Zone charges by never destroying this zone.
- **State Integrity**: The S3 Bucket and DynamoDB Table store your **Source of Truth**.
- **Nameserver Stability**: Zone recreation causes nameserver changes and substantial DNS downtime.

### **Bootstrap Blueprint (Terraform)**
```hcl
# 1. S3 Bucket for Terraform State
resource "aws_s3_bucket" "terraform_state" {
  bucket = "yourname-cricscore-state" # UPDATE THIS
  lifecycle { prevent_destroy = true }
}

resource "aws_s3_bucket_versioning" "terraform_state_versioning" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration { status = "Enabled" }
}

# 2. DynamoDB Table for State Locking
resource "aws_dynamodb_table" "terraform_locks" {
  name         = "terraform-state-locking" # UPDATE THIS
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
  lifecycle { prevent_destroy = true }
}

# 3. Route 53 Primary Hosted Zone
resource "aws_route53_zone" "primary" {
  name = "yourdomain.com" # UPDATE THIS
  lifecycle { prevent_destroy = true }
}
```

---

## 🌩️ Phase 2: Full-Stack Cloud Production

### 1. Aiven Provisioning Checklist (Signup & Capture)
1.  **Signup:** Create an account at [**console.aiven.io**](https://console.aiven.io/).
2.  **Create PG:** Provision **Aiven for PostgreSQL** (Free Tier). Set **SSL Mode** to `require`.
3.  **Create Kafka:** Provision **Aiven for Apache Kafka**. Enable **mTLS** in the console.
4.  **Capture Metadata**: 
    -   **Postgres**: Copy the **Service URI** (e.g., `postgres://avnadmin...`).
    -   **Kafka**: Copy the **Bootstrap Servers** (`host:port`), **Username**, and **Password**.
5.  **Inject into Local**: Update **`terraform/terraform.tfvars`** with these 4 variables.

🔍 **Technical Logic**: See **[`docs/aiven.md`](./aiven.md)** for deep details on Kafka mTLS security and PostgreSQL persistence.

### 2. Security Vault (`certs/`)
CricScore uses mTLS for Kafka security. Download `ca.pem`, `cert.pem`, and `key.pem` from the Aiven Kafka service console.
- **Location**: Place these in a root `/certs/` folder.
- **Injection**: The `./deploy.sh` script automatically copies these to your `kafka-consumer` and `storage-worker` prior to Terraform bundling.
- **⚠️ SECURITY**: Never commit this folder to GitHub. It is excluded by `.gitignore`.

### 3. Infrastructure Variables (`terraform.tfvars`)
Create a file at `terraform/terraform.tfvars` with the following keys. 
- **⚠️ SECURITY**: This file contains secrets. **DO NOT commit it to version control.**

```hcl
# Aiven PostgreSQL
database_url = "postgres://avnadmin:...@host:port/defaultdb?sslmode=require"

# Aiven Kafka
kafka_bootstrap_servers = "host...aivencloud.com:17729"
kafka_username          = "avnadmin"
kafka_password          = "your-password"

# AWS Domain & SES
zone_domain      = "yourdomain.com"
domain_name      = "cricscore.yourdomain.com"
ses_source_email = "noreply@yourdomain.com"
```

### 4. Synchronize Bootstrap Metadata
Follow this character-perfect handshake to activate the remote backend:
1.  **Capture Metadata**: Note your **S3 Bucket Name**, **DynamoDB Lock Table**, and **Route 53 Zone ID**.
2.  **Update Backend**: Insert your bucket and table IDs into **`terraform/providers.tf`**.
    -   *Note: Terraform **requires** these to be hard-coded strings (no variables) because the backend initializes before variables are loaded.*
3.  **Update Variables**: Insert your domain and Aiven details into your newly created **`terraform/terraform.tfvars`**.
4.  **Initialize**: Run `terraform init` in the main `/terraform` directory to migrate state to S3.

### 4. The First-Time Discovery Cycle (Mandatory)
Because the frontend requires the **API Gateway Endpoints** to be built into its bundle, follow this one-time handshake:

1.  **Generate Endpoints**: Run `cd terraform && terraform apply -auto-approve` to provision the AWS stack and generate the first set of outputs.
2.  **Synchronize `.env`**: Note the `api_url` and `websocket_url` from the Terraform output. Inject these into your root **`.env`** file as `VITE_API_URL` and `VITE_WS_URL`.
3.  **Final Launch**: Execute the master deployment script from the root to build the frontend with the correct endpoints and flush the CloudFront cache:
    ```bash
    ./deploy.sh
    ```

© 2026 CricScore Documentation. 🏎️🏁🚀
