# 🚀 Deployment: End-to-End Infrastructure Guide

This guide is designed for developers setting up the project from absolute scratch. Follow these steps sequentially to go from an empty laptop to a fully deployed cloud infrastructure.

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

You must define your environment variables locally before Terraform or the deployment scripts can run.

### 1. Root Configuration (`.env.local`)

Create a file at `.env.local` in the project root. This is the **single source of truth** for all local config — no `terraform.tfvars` needed.

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

# Domains
DOMAIN_NAME='cricscore.yourdomain.com'
ZONE_DOMAIN='yourdomain.com'
SUBDOMAIN_PREFIX='cricscore'
PROJECT_NAME='cricscore'

# Frontend & Deploy Outputs (auto-populated later by deploy.sh)
S3_BUCKET=
CLOUDFRONT_DISTRIBUTION_ID=
```

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
> You do **not** need to manually define `VITE_API_URL` or `VITE_WS_URL`. The local deployment script will automatically extract these from Terraform and inject them into this file later.

---

## 🛡️ Step 3: Bootstrap Governance

Before deploying the application, we must create the permanent infrastructure that holds your deployment state and routing.

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
    - _Note: Terraform **requires** these to be hard-coded strings (no variables)._
2.  **Initialize**: Run `./infra/scripts/terraform.sh init` in the project root to migrate your local state up to S3.

---

## 🚀 Step 4: Full-Stack Cloud Deployment

Because the frontend requires the **API Gateway Endpoints** to be built into its bundle, we use a unified deployment script that handles the entire pipeline locally:

> [!NOTE]
> **Dependency Install Architecture (`infra/scripts/deploy.sh` handles this automatically):**
>
> - **Frontend**: Requires a full `npm install` to download heavy build tools. We only deploy the final compiled output (`dist/`).
> - **Backend (Lambdas)**: Requires strict `npm install --omit=dev`. AWS Lambdas directly upload the raw `node_modules` folder, skipping massive developer tools.

Execute the master deployment script from the root. It will provision Terraform, extract the live endpoints automatically, inject them into `apps/frontend/.env`, build the frontend, and push to S3:

```bash
./infra/scripts/deploy.sh --use-local-env
```

---

## 🧪 Step 5: Local Testing & Validation

Once deployed, you can develop on the platform locally.

### Frontend Development

- **`npm run dev`**: The Sandbox. Use this 99% of the time. Starts a hyper-fast local server with Hot Module Replacement (HMR). Changes instantly appear when you save.
- **`npm run build`**: The Factory. Translates TypeScript, aggressively minifies CSS/JS, and squishes the app.
- **`npm run preview`**: The Rehearsal. Boots a local server pointing directly at the optimized `dist/` folder.

### Pre-Commit Validation

To prevent failing the strict GitHub Actions pipelines, run the bundled validation script locally before pushing:

```bash
./infra/scripts/validate_local.sh
```

This single command automatically executes the entire local testing pyramid:

1. **Frontend**: Lints, runs unit tests, and verifies the production build compiles.
2. **Backend**: Runs the Lambda unit tests.
3. **Infrastructure**: Formats and validates Terraform logic.
4. **End-to-End**: Executes Playwright browser tests against the live environment.
5. **Security**: Runs Checkov (IaC scanning), GitLeaks (secrets), Trivy (CVE vulnerabilities), and Syft (SBOM generation).

> [!NOTE]
> **Local vs. Pull Request Pipelines**
> This local script executes 8+ exact identical checks as your Pull Request CI/CD workflows, giving you 99% confidence your PR will go green.
> The only GitHub Actions pipelines that do **not** run locally are:
>
> - **CodeQL (SAST)**: Skipped locally because compiling the necessary relational database from the entire codebase is too CPU-intensive.
> - **OWASP ZAP (DAST)**: Skipped locally because it actively attacks live deployed AWS endpoints, which aren't available during pure local development.

---

## ⚙️ Step 6: CI/CD — GitHub Actions Workflows

All future deployments are fully automated via GitHub Actions.

| Configuration       | Trigger                                                 | What it does                                                                    |
| ------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `secrets.yml`       | PR → `main`, push to `main`                             | GitLeaks deep historical scan to block hardcoded API keys and AWS tokens        |
| `codeql.yml`        | PR → `main`, push to `main`, weekly schedule            | CodeQL SAST analysis (results in Security tab)                                  |
| `frontend.yml`      | PR → `main` (validate only) / push to `main` (+ deploy) | Lint, Trivy scan, unit test, build → S3 sync + CloudFront invalidation          |
| `backend-infra.yml` | PR → `main` (validate only) / push to `main` (+ deploy) | Lambda checks, Trivy, Terraform validate, Checkov → Terraform apply             |
| `e2e.yml`           | PR → `main`, push to `main`                             | Executes End-to-End Playwright UI tests against the live production environment |
| `dast.yml`          | Post-Frontend deploy, Daily                             | OWASP ZAP black-box dynamic runtime security scanning against live endpoints    |
| `sbom.yml`          | PR → `main`, push to `main`, weekly schedule            | Syft SPDX JSON Generation for supply chain SBOM auditing                        |
| `drift.yml`         | Daily schedule                                          | Detects and reports infrastructure drift from the declared Terraform state      |
| `keepalive.yml`     | Daily schedule, workflow_dispatch                       | Pings the Aiven PostgreSQL database to prevent it from spinning down            |
| `release.yml`       | Push to `main`                                          | Analyzes commits, calculates semantic version, and publishes GitHub Releases    |
| `dependabot.yml`    | Daily schedule                                          | Automated PR generation for outdated npm packages and Terraform providers       |

### Branch Protection (main)

The `main` branch is protected. All PRs must pass all 8 CI status checks before merging:

- `GitLeaks Scan`, `Analyze Code`, `Lint & Test`, `Backend & Terraform Validation`, `playwright-tests`, `Syft SBOM Generation`, `ZAP Baseline Scan`, `Terraform Drift Detection`.

### Required Secrets & Variables

Configure in **Settings → Secrets → Actions** and **Settings → Variables → Actions**:

| Name                                 | Type     | Used By                                     |
| ------------------------------------ | -------- | ------------------------------------------- |
| `AWS_ACCESS_KEY_ID`                  | Secret   | Deploy workflows                            |
| `AWS_SECRET_ACCESS_KEY`              | Secret   | Deploy workflows                            |
| `TF_DATABASE_URL`                    | Secret   | Backend deploy                              |
| `TF_SES_SOURCE_EMAIL`                | Secret   | Backend deploy                              |
| `VITE_ADMIN_PIN`                     | Secret   | Frontend deploy                             |
| `GH_PAT`                             | Secret   | Semantic Release (to trigger other actions) |
| `AWS_REGION`                         | Variable | All workflows                               |
| `AWS_DEFAULT_REGION`                 | Variable | All workflows                               |
| `DOMAIN_NAME`                        | Variable | Backend deploy                              |
| `ZONE_DOMAIN`                        | Variable | Backend deploy                              |
| `SUBDOMAIN_PREFIX`                   | Variable | Backend deploy                              |
| `PROJECT_NAME`                       | Variable | Backend deploy                              |
| `ADMIN_EMAIL`                        | Variable | Backend deploy (SES admin reports)          |
| `API_GATEWAY_ID`                     | Variable | Frontend deploy                             |
| `WS_API_GATEWAY_ID`                  | Variable | Frontend deploy                             |
| `S3_BUCKET`                          | Variable | Frontend deploy                             |
| `CLOUDFRONT_DISTRIBUTION_ID`         | Variable | Frontend deploy                             |
| `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` | Variable | All workflows (forces Node.js 24 runtime)   |

© 2026 CricScore Documentation. 🏎️🏁🚀
