# 🚀 Deployment: End-to-End Infrastructure Guide

This guide covers the 3-phase journey from **Local Development** to **Professional Cloud Production**. 

---

## 🏗️ Phase 0: Local Lifecycle Preview
Test the **v1.5.2** frontend engine locally against the production cloud backend.

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

### 1. Provision Managed Aiven Services
1. **Aiven PostgreSQL**: Master system of record (Set SSL Mode to `require`).
2. **Aiven Kafka**: Event streaming backbone (Enable **mTLS** in console).

### 2. Configure Security Vault (`certs/`)
Download `ca.pem`, `cert.pem`, and `key.pem` from Aiven Kafka and place them in a root `/certs` folder at the project base.

### 3. Synchronize Bootstrap Metadata
Follow this character-perfect handshake to activate the remote backend:
1.  **Capture Metadata**: Note your **S3 Bucket Name**, **DynamoDB Lock Table**, and **Route 53 Zone ID**.
2.  **Update Backend**: Insert your bucket and table IDs into **[`terraform/providers.tf`](../terraform/providers.tf)**.
3.  **Update Variables**: Insert your domain details into **[`terraform/terraform.tfvars`](../terraform/terraform.tfvars)**.
4.  **Initialize**: Run `terraform init` in the main `/terraform` directory to migrate state to S3.

### 4. Deploy Infrastructure (via `./deploy.sh`)
```bash
# Execute the master deployment script
./deploy.sh
```

© 2026 CricScore Documentation. 🏎️🏁🚀
