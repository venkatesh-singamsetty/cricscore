# 🛡️ Bootstrap Infrastructure: Long-Lived Assets

Managed separately from the main app stack to ensure **Persistence and Cost Efficiency**.

---

### ⚠️ GOVERNANCE: Create Once, Never Destroy
- **Cost (Route 53)**: Each Hosted Zone is **$0.50/mo**. Recurring recreate-cycles add redundant monthly charges.
- **State Registry**: Stores the **S3/DynamoDB Source of Truth**. Deletion orphans your cloud resources.
- **DNS Identity**: Nameservers are tied to a specific **Zone ID**. Zone recreation causes high-latency DNS propogation delays.

---

### 📝 MANDATORY: Details to Update
Update these in the code block below **before** execution:
- **`bucket`**: Change to a globally unique name (e.g., `yourname-cricscore-state`).
- **`name` (DynamoDB)**: Your lock table name.
- **`name` (Route 53)**: Your primary domain name.

---

### 🔍 Technical Blueprint (Terraform)
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

## 🔄 Integration Flow (Handshake)

1.  **Provision Bootstrap**: Execute the Terraform block above once in an isolated folder.
2.  **Metadata Capture**: Note your **S3 Bucket**, **Dynamo table**, and **Route 53 Zone ID**.
3.  **App Sync**: Update the `backend "s3" {}` block in **[`terraform/providers.tf`](../terraform/providers.tf)**.
4.  **Variable Sync**: Update **[`terraform/terraform.tfvars`](../terraform/terraform.tfvars)** with your domain details.
5.  **Initialize**: Run `terraform init` in the main `/terraform` directory.

© 2026 CricScore Documentation. 🏎️🏁🚀
