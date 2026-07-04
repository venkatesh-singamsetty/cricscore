# 🚀 Deployment: End-to-End Infrastructure Guide

This guide is designed for developers setting up the project from absolute scratch. Follow these steps sequentially to go from an empty laptop to a fully deployed cloud infrastructure with dual environments (`dev` and `prod`).

---

## 🛑 Step 0: Absolute Prerequisites

Before you touch any code, you must secure the foundational accounts and assets for the platform.

### 1. Purchase a Domain Name

The AWS architecture requires a registered domain name (e.g., `yourdomain.com`).

1. Go to a registrar like [GoDaddy](https://godaddy.com) or [Namecheap](https://namecheap.com).
2. Purchase your desired domain name. You do _not_ need to purchase any hosting or email packages.

### 2. Create Cloud Accounts

1. **AWS Account**: Sign up at [aws.amazon.com](https://aws.amazon.com/). You will need an IAM User with Administrator privileges and an Access Key.
2. **Aiven PostgreSQL**: Sign up at [console.aiven.io](https://console.aiven.io/) and create a Free Tier PostgreSQL database. Set the **SSL Mode** to `require` and copy the **Service URI** (`postgres://avnadmin...`).
   _(Note: Both `dev` and `prod` environments will share this database but are strictly isolated via PostgreSQL schemas: `dev` and `prod`.)_

---

## 💻 Step 1: Local Environment Setup

To run or deploy CricScore locally, your computer needs Node.js, Terraform, AWS CLI, and a suite of security scanners.

We provide an automated setup script that detects your OS (macOS/Linux) and uses native package managers to install everything you need perfectly.

```bash
# Run this from the root of the repository
./infra/scripts/setup.sh
```

---

## 🔐 Step 2: Local Configuration

You must define your global environment variables locally before Terraform or the deployment scripts can run.

### 1. Root Configuration (`.env.local`)

Create a file at `.env.local` in the project root. This file provides the core authentication secrets.

- **⚠️ SECURITY**: This file contains secrets. **DO NOT commit it to version control.**

```bash
# AWS Credentials & Region
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION='us-east-1'
AWS_DEFAULT_REGION='us-east-1'

# Database & Email
TF_DATABASE_URL='postgres://avnadmin:...@host:port/defaultdb?sslmode=require'
TF_SES_SOURCE_EMAIL='noreply@yourdomain.com'
ADMIN_EMAIL='your-email@gmail.com'
```

_(Environment-specific variables like domains and project names are now safely managed in `infra/terraform/environments/dev.tfvars` and `prod.tfvars`.)_

### 2. Frontend Configuration (`apps/frontend/.env`)

Create a file at `apps/frontend/.env` (use `apps/frontend/.env.example` as a template):

```bash
# The secret PIN required for the scorer/admin dashboard
VITE_ADMIN_PIN=123456

# The default email address to pre-fill in the scorer login
VITE_DEFAULT_EMAIL=admin@example.com

# (Optional) Sentry Crash Reporting Data Source Name
VITE_SENTRY_DSN=
```

> [!NOTE]
> You do **not** need to manually define `VITE_API_URL`, `VITE_WS_URL`, or `VITE_APP_TITLE`. The local deployment script automatically extracts these from Terraform and injects them into this file.

---

## 🛡️ Step 3: Bootstrap Governance

Before deploying the application, we must create the permanent infrastructure that holds your deployment state.

**These resources are created once and should NEVER be destroyed.**

### 1. Apply the Bootstrap Configuration

Update the placeholders below and apply them using Terraform:

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

### 2. The DNS Handshake (GoDaddy/Registrar)

When AWS creates your Route 53 zone, it generates 4 unique Nameservers (NS records).

1. Open the AWS Route 53 Console and copy those 4 Nameservers.
2. Log into your domain registrar (e.g., GoDaddy).
3. Find the "DNS Settings" or "Nameservers" section for your domain.
4. Replace the default GoDaddy nameservers with the 4 custom AWS nameservers.
5. _Wait 15-60 minutes for global DNS propagation to occur._

### 3. Synchronize Bootstrap Metadata

1.  **Update Backend**: Insert your new S3 bucket and DynamoDB table names into **`infra/terraform/providers.tf`**.
2.  **Initialize**: Run `./infra/scripts/terraform.sh init` in the project root.

---

## 🚀 Step 4: Full-Stack Cloud Deployment

Because the frontend requires the **API Gateway Endpoints** to be built into its bundle, we use a unified deployment script that handles the entire pipeline locally.

Execute the master deployment script and specify which environment to deploy (`dev` or `prod`). It will provision Terraform, extract the live endpoints automatically, inject them into `apps/frontend/.env`, build the frontend, and push to S3:

```bash
# Deploy the Development Environment
./infra/scripts/deploy.sh --use-local-env --env dev

# Deploy the Production Environment
./infra/scripts/deploy.sh --use-local-env --env prod
```

---

## 🧪 Step 5: Local Testing & Validation

Once deployed, you can develop on the platform locally.

### Frontend Development

- **`npm run dev`**: Starts a hyper-fast local server pointing to the dev backend APIs.
- **`npm run build`**: Translates TypeScript and builds the app.

### Pre-Commit Validation

To prevent failing the strict GitHub Actions pipelines, run the bundled validation script locally before pushing:

```bash
./infra/scripts/validate_local.sh
```

---

## ⚙️ Step 6: CI/CD — GitHub Actions Workflows

All future deployments are fully automated via GitHub Actions with distinct `dev` and `prod` targets.

### Setting Up GitHub Environments Automatically

We provide a powerful script that uses the GitHub CLI to automatically create your `dev` and `prod` environments, parse your local `.env.local` and `.tfvars` files, and automatically upload all required GitHub Secrets and Variables to your repository!

> [!CAUTION]
> **This is a ONE-TIME Bootstrap Tool.**
> Do not run this script regularly as part of your day-to-day workflow. If you experiment with your local `.env.local` or `.tfvars` files and then run this script, it **will blindly overwrite** your real GitHub Secrets and Variables with your local testing data, potentially breaking your cloud pipelines. Once you have bootstrapped your repository, you should make any future credential updates manually via the GitHub UI (**Settings → Environments**).

1. Install and authenticate the GitHub CLI (`brew install gh` && `gh auth login`).
2. Run the automated setup script:
   ```bash
   ./infra/scripts/setup_github_envs.sh
   ```

### Branch Protection & Deployment Rules

To protect the integrity of environments, CricScore enforces the following deployment policies:

- **Pull Request (PR) Validation**: When a PR is opened or updated, the pipeline runs code formatters, security scanners, and test suites (including Playwright E2E tests). **No deployments are performed on PR branches** to prevent developers from concurrently overwriting and breaking the shared `dev` sandbox environment.
- **Merge/Push to `main`**: Merging a PR into `main` automatically triggers a sequential deployment:
  1. Installs, builds, formats, and validates the branch.
  2. Automatically deploys the changes to the **`dev`** environment context first.
  3. Sequentially triggers the deployment to the **`prod`** environment context.
- **Manual Deployments**: Deploys can be manually triggered to target `dev` or `prod` using the `workflow_dispatch` option in the GitHub Actions UI.

© 2026 CricScore Documentation. 🏎️🏁🚀
