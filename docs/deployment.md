# 🚀 Deployment: End-to-End Infrastructure Guide

This guide covers the 3-phase journey from **Local Development** to **Professional Cloud Production**.

---

## ⚡ Local Environment & Testing

### 1. Prerequisite Installation

To run or deploy CricScore locally, you need Node.js, Terraform, AWS CLI, Checkov, and GitLeaks.
💡 **Pro-Tip:** You can automatically install all required tools on macOS or Linux by simply running:

```bash
./infra/scripts/setup.sh
```

### 2. Frontend Local Development

We provide a convenient root-level `package.json` that acts as a proxy to the `frontend/` directory so you don't have to change folders. Here is the local development lifecycle:

- **`npm run dev`**: The Sandbox. Use this 99% of the time. Starts a hyper-fast local server with Hot Module Replacement (HMR). Changes instantly appear when you save.
- **`npm run build`**: The Factory. Translates TypeScript, aggressively minifies CSS/JS, and squishes the app into a highly optimized `apps/frontend/dist/` folder for AWS production.
- **`npm run preview`**: The Rehearsal. Boots a local server pointing directly at the optimized `dist/` folder. Use this specifically to test exact production load speeds or debug minification issues before opening a PR.

### 3. Pre-Commit Validation

To prevent failing the strict GitHub Actions pipelines, validate your code locally before pushing:

```bash
# Frontend Validation
cd apps/frontend
npm run lint    # Catches unused variables and TS errors
npm run test    # Executes component unit tests
npm run build   # Validates the production bundle compiles
cd ..

# Infrastructure Validation
./infra/scripts/terraform.sh fmt -check -recursive  # Validates HCL formatting
./infra/scripts/terraform.sh validate               # Validates infrastructure logic
checkov -d infra/terraform/                         # (Optional) Run local IaC security scans

# Secrets Detection
gitleaks detect --source . -v    # Detects accidental AWS keys or passwords
```

**⚠️ Optional Manual Dependency Scanning (Trivy)**
Trivy is not configured as an automatic pre-commit hook because downloading its massive vulnerability database locally on every commit severely degrades developer speed. It is strictly executed in the cloud pipelines.

If you are specifically debugging a dependency issue, you can scan locally:

```bash
# Requires: brew install trivy
trivy fs ./apps/frontend --scanners vuln --severity HIGH,CRITICAL
trivy fs ./apps/backend/lambdas --scanners vuln --severity HIGH,CRITICAL
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

# Frontend & Deploy Outputs (auto-populated by infra/scripts/deploy.sh after first apply)
S3_BUCKET=your-s3-bucket-name
CLOUDFRONT_DISTRIBUTION_ID=YOURCLOUDFRONT
```

### 3. Synchronize Bootstrap Metadata

Follow this character-perfect handshake to activate the remote backend:

1.  **Capture Metadata**: Note your **S3 Bucket Name**, **DynamoDB Lock Table**, and **Route 53 Zone ID**.
2.  **Update Backend**: Insert your bucket and table IDs into **`terraform/providers.tf`**.
    - _Note: Terraform **requires** these to be hard-coded strings (no variables) because the backend initializes before variables are loaded._
3.  **Initialize**: Run `./infra/scripts/terraform.sh init` in the project root to migrate state to S3.

> [!TIP]
> Use `./infra/scripts/terraform.sh` for all Terraform commands locally. It automatically reads `.env.local` and maps variables — identical to how CI injects `TF_VAR_*` from GitHub Secrets/Variables. No separate `terraform.tfvars` file is needed.

### 4. Deploying the Cloud Stack

Because the frontend requires the **API Gateway Endpoints** to be built into its bundle, we use a unified deployment script that handles the entire pipeline locally:

> [!NOTE]
> **Dependency Install Architecture (`infra/scripts/deploy.sh` handles this automatically):**
>
> - **Frontend**: Requires a full `npm install` to download heavy build tools (Vite, TypeScript). We only deploy the final compiled output (`dist/`), _not_ the `node_modules`.
> - **Backend (Lambdas)**: Requires strict `npm install --production`. AWS Lambdas directly upload the raw `node_modules` folder. Passing `--production` ensures massive developer tools aren't uploaded to AWS, which would drastically degrade performance and cause cold-start issues.

Execute the master deployment script from the root. It will provision Terraform, extract the live endpoints automatically, inject them into `apps/frontend/.env`, build the frontend, and push to S3:

```bash
./infra/scripts/deploy.sh --use-local-env
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
| `e2e.yml`           | PR → `main`, push to `main`                             | Executes End-to-End Playwright UI tests against the staging environment      |
| `dast.yml`          | Post-Frontend deploy, Daily                             | OWASP ZAP black-box dynamic runtime security scanning against live endpoints |
| `sbom.yml`          | PR → `main`, push to `main`, weekly schedule            | Syft SPDX JSON Generation for supply chain SBOM auditing                     |
| `drift.yml`         | Daily schedule                                          | Detects and reports infrastructure drift from the declared Terraform state   |
| `keepalive.yml`     | Daily schedule, workflow_dispatch                       | Pings the Aiven PostgreSQL database to prevent it from spinning down         |
| `release.yml`       | Push to `main`                                          | Analyzes commits, calculates semantic version, and publishes GitHub Releases |
| `dependabot.yml`    | Daily schedule                                          | Automated PR generation for outdated npm packages and Terraform providers    |

### Branch Protection (main)

The `main` branch is protected. All PRs must pass all 8 CI status checks before merging:

- `GitLeaks Scan` (Secrets Detection)
- `Analyze Code (javascript-typescript)` (CodeQL Analysis)
- `Lint & Test` (Frontend CI/CD)
- `Backend & Terraform Validation` (Backend & Infrastructure CI/CD)
- `playwright-tests` (End-to-End Browser Testing)
- `Syft SBOM Generation` (Supply Chain Auditing)
- `ZAP Baseline Scan` (Dynamic Application Security Testing)
- `Terraform Drift Detection` (Infrastructure State Validation)

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
