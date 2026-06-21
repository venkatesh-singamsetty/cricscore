# 🚀 Deployment: End-to-End Infrastructure Guide

This guide covers the 3-phase journey from **Local Development** to **Professional Cloud Production**.

---

## 🏗️ Phase 0: Local Lifecycle Preview

Test the **Fan-Out** frontend engine locally against the production cloud backend.

### **Prerequisites**

- **Node.js**: Version **24.x or higher**.
- **npm**: Included with Node.js.
- **Git**: To clone the repository.
- **Terraform**: 1.5+
- **AWS CLI**: 2.0+

💡 **Pro-Tip**: You can automatically install all required tools on macOS or Ubuntu by simply running:

```bash
./scripts/setup.sh
```

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/venkatesh-singamsetty/cricscore.git
    cd cricscore && npm install --prefix frontend
    ```
2.  **Initialize Environment**:
    ```bash
    npm run dev --prefix frontend
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
3.  **Capture Metadata**: Copy the PostgreSQL **Service URI** (e.g., `postgres://avnadmin...`).
4.  **Inject into Local**: Update your **`.env.local`** file with the `TF_DATABASE_URL` variable.

🔍 **Technical Logic**: See **[`docs/aiven.md`](./aiven.md)** for details on PostgreSQL database configuration.

### 2. Local Infrastructure Configuration (`.env.local`)

Create a file at `.env.local` in the project root. This is the **single source of truth** for all local config — no `terraform.tfvars` needed.

- **⚠️ SECURITY**: This file contains secrets. **DO NOT commit it to version control.**

```bash
# AWS Credentials & Region
# AWS_ACCESS_KEY_ID=AKIA...
# AWS_SECRET_ACCESS_KEY=...
AWS_REGION='us-east-1'
AWS_DEFAULT_REGION='us-east-1'

# Database & Email
TF_DATABASE_URL='postgres://avnadmin:...@host:port/defaultdb?sslmode=require'
TF_SES_SOURCE_EMAIL='noreply@yourdomain.com'
ADMIN_EMAIL='your-email@gmail.com'

# Domains
DOMAIN_NAME='cricscore.yourdomain.com'
ZONE_DOMAIN='yourdomain.com'
SUBDOMAIN_PREFIX='cricscore'
PROJECT_NAME='cricscore'

# Frontend & Deploy Outputs (auto-populated by deploy.sh after first apply)
S3_BUCKET=your-s3-bucket-name
CLOUDFRONT_DISTRIBUTION_ID=YOURCLOUDFRONT
```

### 3. Synchronize Bootstrap Metadata

Follow this character-perfect handshake to activate the remote backend:

1.  **Capture Metadata**: Note your **S3 Bucket Name**, **DynamoDB Lock Table**, and **Route 53 Zone ID**.
2.  **Update Backend**: Insert your bucket and table IDs into **`terraform/providers.tf`**.
    - _Note: Terraform **requires** these to be hard-coded strings (no variables) because the backend initializes before variables are loaded._
3.  **Initialize**: Run `./scripts/terraform.sh init` in the project root to migrate state to S3.

> [!TIP]
> Use `./scripts/terraform.sh` for all Terraform commands locally. It automatically reads `.env.local` and maps variables — identical to how CI injects `TF_VAR_*` from GitHub Secrets/Variables. No separate `terraform.tfvars` file is needed.

### 4. Deploying the Cloud Stack

Because the frontend requires the **API Gateway Endpoints** to be built into its bundle, we use a unified deployment script that handles the entire pipeline locally:

> [!NOTE]
> **Dependency Install Architecture (`deploy.sh` handles this automatically):**
>
> - **Frontend**: Requires a full `npm install` to download heavy build tools (Vite, TypeScript). We only deploy the final compiled output (`dist/`), _not_ the `node_modules`.
> - **Backend (Lambdas)**: Requires strict `npm install --production`. AWS Lambdas directly upload the raw `node_modules` folder. Passing `--production` ensures massive developer tools aren't uploaded to AWS, which would drastically degrade performance and cause cold-start issues.

Execute the master deployment script from the root. It will provision Terraform, extract the live endpoints automatically, inject them into `frontend/.env`, build the frontend, and push to S3:

```bash
./deploy.sh --use-local-env
```

---

## ⚙️ Phase 3: CI/CD — GitHub Actions Workflows

All deployments are fully automated via GitHub Actions. The core automation configurations are:

| Configuration       | Trigger                                                 | What it does                                                                 |
| ------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `secrets.yml`       | PR → `main`, push to `main`                             | GitLeaks deep historical scan to block hardcoded API keys and AWS tokens     |
| `codeql.yml`        | PR → `main`, push to `main`, weekly schedule            | CodeQL SAST analysis (results in Security tab)                               |
| `frontend.yml`      | PR → `main` (validate only) / push to `main` (+ deploy) | Lint, Trivy scan, unit test, build → S3 sync + CloudFront invalidation       |
| `backend-infra.yml` | PR → `main` (validate only) / push to `main` (+ deploy) | Lambda checks, Trivy, Terraform validate, Checkov → Terraform apply          |
| `dast.yml`          | Post-Frontend deploy, Daily                             | OWASP ZAP black-box dynamic runtime security scanning against live endpoints |
| `sbom.yml`          | PR → `main`, push to `main`, weekly schedule            | Syft SPDX JSON Generation for supply chain SBOM auditing                     |
| `dependabot.yml`    | Daily schedule                                          | Automated PR generation for outdated npm packages and Terraform providers    |

### Branch Protection (main)

The `main` branch is protected. All PRs must pass all 4 CI status checks before merging:

- `GitLeaks Scan` (Secrets Detection)
- `Analyze Code (javascript-typescript)` (CodeQL Analysis)
- `Lint & Test` (Frontend CI/CD)
- `Backend & Terraform Validation` (Backend & Infrastructure CI/CD)

### Required Secrets & Variables

Configure in **Settings → Secrets → Actions** and **Settings → Variables → Actions**:

| Name                                 | Type     | Used By                                   |
| ------------------------------------ | -------- | ----------------------------------------- |
| `AWS_ACCESS_KEY_ID`                  | Secret   | Deploy workflows                          |
| `AWS_SECRET_ACCESS_KEY`              | Secret   | Deploy workflows                          |
| `TF_DATABASE_URL`                    | Secret   | Backend deploy                            |
| `TF_SES_SOURCE_EMAIL`                | Secret   | Backend deploy                            |
| `VITE_ADMIN_PIN`                     | Secret   | Frontend deploy                           |
| `AWS_REGION`                         | Variable | All workflows                             |
| `AWS_DEFAULT_REGION`                 | Variable | All workflows                             |
| `DOMAIN_NAME`                        | Variable | Backend deploy                            |
| `ZONE_DOMAIN`                        | Variable | Backend deploy                            |
| `SUBDOMAIN_PREFIX`                   | Variable | Backend deploy                            |
| `PROJECT_NAME`                       | Variable | Backend deploy                            |
| `ADMIN_EMAIL`                        | Variable | Backend deploy (SES admin reports)        |
| `API_GATEWAY_ID`                     | Variable | Frontend deploy                           |
| `WS_API_GATEWAY_ID`                  | Variable | Frontend deploy                           |
| `S3_BUCKET`                          | Variable | Frontend deploy                           |
| `CLOUDFRONT_DISTRIBUTION_ID`         | Variable | Frontend deploy                           |
| `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` | Variable | All workflows (forces Node.js 24 runtime) |

© 2026 CricScore Documentation. 🏎️🏁🚀
