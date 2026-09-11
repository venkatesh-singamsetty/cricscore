# 🚀 Deployment Guide

This is the full deployment reference for CricScore. For the quick fresh-clone checklist, see [deployment_checklist.md](./deployment_checklist.md).

This guide walks you through deploying your own CricScore instance from scratch — from registering a domain to having a live, fully-featured cricket scoring platform running in the cloud.

---

## What You'll Build

- A **dev environment** (e.g., `cricscoredev.yourdomain.com`) for testing
- A **prod environment** (e.g., `cricscore.yourdomain.com`) for live matches
- Fully automated CI/CD that deploys on every push to `main`

---

## Step 0: Get Your Accounts & Domain

You need three things before touching any code.

### 1. A Domain Name

Buy a domain from [GoDaddy](https://godaddy.com) or [Namecheap](https://namecheap.com)

### 2. An AWS Account

Sign up at [aws.amazon.com](https://aws.amazon.com/). After signing in:

1. Go to **IAM → Users → Create User**
2. Attach the **AdministratorAccess** policy
3. Go to **Security Credentials → Create Access Key** and save the `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

### 3. An Aiven PostgreSQL Database

Sign up at [console.aiven.io](https://console.aiven.io/) and create a **free** PostgreSQL service:

1. Click **Create Service → PostgreSQL**
2. Choose the **Free** plan
3. After it starts, click your service → **Overview** → copy the **Service URI** (starts with `postgres://avnadmin:...`)

> [!NOTE]
> Both `dev` and `prod` share one Aiven database. They are isolated via PostgreSQL schemas (`dev` and `prod`).

### 4. An OpenRouter API Key (for AI features)

Sign up at [openrouter.ai](https://openrouter.ai) and create an API key. This powers the AI chat assistant.

---

## Step 1: Clone & Install Tools

```bash
git clone https://github.com/venkatesh-singamsetty/cricscore.git
cd cricscore

# Install Node.js, Terraform, AWS CLI, and security tools automatically
./infra/scripts/setup.sh
```

---

## Step 2: Configure Your Environment

### 2a. Root config — `.env.local`

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```bash
# AWS credentials
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_DEFAULT_REGION=us-east-1

# Aiven PostgreSQL connection string
TF_DATABASE_URL='postgres://avnadmin:PASSWORD@HOST:PORT/defaultdb?sslmode=require'

# Email — SES will send from this address (must be verified in SES)
TF_SES_SOURCE_EMAIL='noreply@yourdomain.com'

# Your email — receives BCC of all match report emails
ADMIN_EMAIL='you@youremail.com'

# Your domain settings
DOMAIN_NAME='cricscore.yourdomain.com'
ZONE_DOMAIN='yourdomain.com'
SUBDOMAIN_PREFIX='cricscore'
PROJECT_NAME='cricscore'

# AI / LLM
LLM_API_KEY='your-openrouter-api-key'
LLM_BASE_URL='https://openrouter.ai/api/v1'
```

> [!CAUTION]
> Never commit `.env.local` to version control. It is in `.gitignore` by default.

### 2b. Set your domain in the Terraform config files

Open **`infra/terraform/environments/dev.tfvars`** and update all four values:

```hcl
environment      = "dev"
project_name     = "myappdev"
domain_name      = "cricscoredev.yourdomain.com"
zone_domain      = "yourdomain.com"
subdomain_prefix = "cricscoredev"
```

Open **`infra/terraform/environments/prod.tfvars`** and update:

```hcl
environment      = "prod"
project_name     = "myapp"
domain_name      = "cricscore.yourdomain.com"
zone_domain      = "yourdomain.com"
subdomain_prefix = "cricscore"
```

> [!IMPORTANT]
> `zone_domain` must match exactly the root domain you registered (e.g., `yourdomain.com`).
> `domain_name` is the full URL your app will be served at.

### 2c. Frontend config — `apps/frontend/.env`

```bash
cp apps/frontend/.env.example apps/frontend/.env
```

You only need to set the optional Sentry DSN if you want crash reporting. Everything else is auto-populated by the deploy script.

```bash
# (Optional) Sentry Crash Reporting DSN
VITE_SENTRY_DSN=
```

---

## Step 3: Bootstrap — One-Time AWS Setup

This creates the S3 bucket and DynamoDB table that store your Terraform state, plus the Route 53 hosted zone for your domain. **Run this once.**

### 3a. Update `infra/terraform/providers.tf`

Open `infra/terraform/providers.tf` and set your state bucket name (must be globally unique):

```hcl
backend "s3" {
  bucket         = "yourname-cricscore-state"   # Pick a unique name
  key            = "cricscore/terraform.tfstate"
  region         = "us-east-1"
  dynamodb_table = "terraform-state-locking"
  encrypt        = true
}
```

Then in `infra/terraform/bootstrap/` apply the bootstrap config:

```bash
cd infra/terraform/bootstrap
terraform init
terraform apply
```

This creates the S3 state bucket, DynamoDB lock table, and Route 53 hosted zone.

### 3b. Point your domain to AWS

After the bootstrap runs, AWS gives you 4 nameservers:

1. Go to **AWS Console → Route 53 → Hosted Zones → your domain**
2. Copy the 4 NS record values
3. Log into your domain registrar (GoDaddy / Namecheap)
4. Replace the default nameservers with your 4 AWS nameservers
5. Wait **15–60 minutes** for DNS propagation

### 3c. Verify SES email

1. Go to **AWS Console → SES → Verified Identities → Create Identity**
2. Enter `yourdomain.com` and verify ownership via the DNS TXT record shown
3. This lets SES send match report emails from `noreply@yourdomain.com`

---

## Step 4: Deploy

Run the deploy script for your target environment:

```bash
# Deploy dev
./deploy_local_dev.sh

# Deploy prod
./deploy_local_prod.sh
```

The script automatically:

1. Runs PostgreSQL database schema migrations
2. Provisions all AWS infrastructure via Terraform
3. Reads the live API Gateway and WebSocket URLs from Terraform output
4. Injects them into `apps/frontend/.env`
5. Builds the React app
6. Uploads to S3 and invalidates CloudFront cache

After a successful deploy you'll see:

```
✅ Local DEV Deployment Complete!
```

Your app is live at `https://cricscoredev.yourdomain.com` (or your configured domain).

---

## Step 5: Local Development

After deploying at least once (so the backend exists), run the frontend locally:

```bash
cd apps/frontend
npm run dev
```

This starts a local dev server that points to your deployed backend APIs.

To run all unit and API tests:

```bash
npm run test:all
```

---

## Step 6: Automate with GitHub Actions (CI/CD)

### 6a. Upload your secrets to GitHub

We provide a script that reads your `.env.local` and `.tfvars` files and uploads everything to GitHub automatically:

```bash
# Install GitHub CLI first
brew install gh
gh auth login

# Upload all secrets and variables
./infra/scripts/setup_github_envs.sh
```

> [!CAUTION]
> Run this **once during setup only**. If you run it again after changing local test values, it will overwrite your real GitHub Secrets.

### 6b. How the pipeline works

| Event               | What Happens                                                                |
| ------------------- | --------------------------------------------------------------------------- |
| **Open/Update PR**  | Runs formatters, security scans, unit tests, and E2E tests. No deployment.  |
| **Merge to `main`** | Deploys to `dev` first, then sequentially to `prod`.                        |
| **Manual trigger**  | Go to GitHub Actions → workflow → `Run workflow` to target `dev` or `prod`. |

---

## Step 7: Sign In & Set Up Admin

1. Open your live app and click the **SCORER** tab
2. Click **Create Account**, fill in your name and email, and create a password
3. To make your account an Admin:
   - Go to **AWS Console → Cognito → User Pools → your pool → Groups → Admin**
   - Click **Add user** and add yourself
4. Sign out and sign back in — you will now see the **Admin Panel** tab

---

## Troubleshooting

See [troubleshooting.md](./troubleshooting.md) for solutions to common issues.

For quick checks:

- **App not loading**: CloudFront cache may be propagating — wait 5 minutes and hard-refresh
- **Login not working**: Check that Cognito User Pool and Client IDs are correctly output by Terraform
- **Emails not sending**: Verify your SES domain identity in the AWS console

---

© 2026 CricScore Documentation
