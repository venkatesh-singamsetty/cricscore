# 🚀 Deployment Guide

This is the full deployment reference for CricScore — from registering a domain to having a live, fully-featured cricket scoring platform running in the cloud.

<details>
<summary><b>⚡ TL;DR — Clone-to-Deploy Quick Checklist</b> (click to expand)</summary>

> Important: this project is not a pure local-only app. A fresh clone still needs AWS, Aiven PostgreSQL, domain/DNS, SES, Cognito, and an OpenAI API key.

1. `git clone https://github.com/venkatesh-singamsetty/cricscore.git && cd cricscore`
2. `./infra/scripts/setup.sh` — Install Node.js, Terraform, AWS CLI
3. `cp .env.local.example .env.local` — Fill in AWS, Aiven, domain, OpenAI values
4. `cp apps/frontend/.env.example apps/frontend/.env` — Optional Sentry DSN
5. Edit `infra/terraform/environments/dev.tfvars` and `prod.tfvars` with your domain
6. Bootstrap: `cd infra/terraform/bootstrap && terraform init && terraform apply`
7. Point domain registrar nameservers → Route 53 NS records
8. Verify SES domain identity in AWS Console
9. Deploy: `./infra/scripts/deploy.sh --env dev --use-local-env`
10. CI/CD: `gh auth login && ./infra/scripts/setup_github_envs.sh`
11. Create account → add to Cognito `Admin` group → sign out/in

**Required external dependencies:** AWS account + IAM, Route 53 / domain, Aiven PostgreSQL, Cognito (via Terraform), SES domain verification, OpenAI API key.

</details>

---

## What You'll Build

- A **dev environment** (e.g., `cricscoredev.yourdomain.com`) for testing
- A **prod environment** (e.g., `cricscore.yourdomain.com`) for live matches
- CI validates pull requests; pushes to `main` can trigger the development deployment workflow.

---

## Step 0: Get Your Accounts & Domain

You need four things before deploying the application.

### 1. A Domain Name

Buy a domain from [Spaceship](https://www.spaceship.com/), [Porkbun](https://porkbun.com/), [Cloudflare](https://www.cloudflare.com/products/registrar/), or [GoDaddy](https://godaddy.com).

### 2. An AWS Account

Sign up at [aws.amazon.com](https://aws.amazon.com/). After signing in:

1. Configure local AWS CLI credentials using IAM Identity Center, an assumed role, or a dedicated IAM identity.
2. Use a dedicated deployment identity with only the permissions required for the resources managed by Terraform; avoid using root credentials or granting broad administrator access for routine deploys.
3. The current GitHub deployment workflows use `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment secrets. If using those workflows, configure credentials for a dedicated deploy identity and store them as GitHub environment secrets.

### 3. An Aiven PostgreSQL Database

Sign up at [console.aiven.io](https://console.aiven.io/) and create a PostgreSQL service on a plan available to your account:

1. Click **Create Service → PostgreSQL**
2. Choose an available plan that fits your workload and budget; availability, eligibility, and pricing can change.
3. After it starts, click your service → **Overview** → copy the **Service URI** (starts with `postgres://avnadmin:...`)

> [!NOTE]
> Dev and prod use separate PostgreSQL schemas when configured to share a database instance. Configure each environment's database connection string as appropriate.

### 4. An OpenAI API Key (for AI features)

Sign up at [openai.com](https://openai.com) and create an API key. This powers the AI chat assistant.

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
LLM_API_KEY='your-openai-api-key'
LLM_BASE_URL='https://api.openai.com/v1'
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

This creates the S3 state bucket and Route 53 hosted zone for your domain. **Run this once.**

### 3a. Configure and Run Bootstrap

The bootstrap creates the S3 state bucket and Route 53 hosted zone. Terraform uses native S3 lock files; the bootstrap's legacy DynamoDB lock table is not used by the current backend.

1. Navigate to the bootstrap folder:

```bash
cd infra/terraform/bootstrap
```

2. Copy the example variables file:

```bash
cp terraform.tfvars.example terraform.tfvars
```

3. Open `terraform.tfvars` and fill in your desired bucket name and domain name.
4. Apply the configuration:

```bash
terraform init
terraform apply
```

### 3b. Update `infra/terraform/providers.tf`

Now that your bucket exists, tell the main infrastructure where to store its state. Open `infra/terraform/providers.tf` and match the exact bucket name you just used in the bootstrap:

```hcl
backend "s3" {
  bucket         = "yourname-cricscore-state"   # Match the bootstrap bucket name
  key            = "cricscore/terraform.tfstate"
  region         = "us-east-1"
  use_lockfile   = true
  encrypt        = true
}
```

### 3c. Point your domain to AWS

After the bootstrap runs, AWS gives you 4 nameservers:

1. Go to **AWS Console → Route 53 → Hosted Zones → your domain**
2. Copy the 4 NS record values
3. Log into your domain registrar (GoDaddy / Namecheap)
4. Replace the default nameservers with your 4 AWS nameservers
5. Wait **15–60 minutes** for DNS propagation

### 3d. Verify SES email

1. Go to **AWS Console → SES → Verified Identities → Create Identity**
2. Enter `yourdomain.com` and verify ownership via the DNS TXT record shown
3. Verify the sender identity used by the app. If the SES account is still in the sandbox, recipients must also be verified; request production access if the app needs to email unverified recipients.

---

## Step 4: Deploy

Run the canonical deploy script for your target environment:

```bash
# Deploy dev
./infra/scripts/deploy.sh --env dev --use-local-env

# Deploy prod
./infra/scripts/deploy.sh --env prod --use-local-env
```

The script automatically:

1. Installs frontend and Lambda dependencies
2. Initializes Terraform and applies AWS infrastructure
3. Reads the live API Gateway and WebSocket URLs from Terraform output
4. Rewrites the generated `VITE_*` entries in `apps/frontend/.env`
5. Builds the React app
6. Uploads to S3 and invalidates CloudFront cache

The local deploy script does **not** run database migrations. Run them separately
from `infra/database`, using the connection string for the target environment:

```bash
set -a
source .env.local
set +a
(cd infra/database && ./migrate.sh "$TF_DATABASE_URL" dev)
```

Use `prod` instead of `dev` only when intentionally migrating the production
schema. The GitHub deployment workflows run the corresponding migration step.

After a successful local deploy, the script prints the deployed website URL.

Your app is live at `https://cricscoredev.yourdomain.com` (or your configured domain).

---

## Step 5: Local Development

After deploying at least once (so the backend exists), run the frontend locally:

```bash
cd apps/frontend
npm run dev
```

This starts a local dev server that points to your deployed backend APIs.

To run the frontend and backend test suites followed by the HTTP-based chat evaluation (set `CHAT_API_URL` to a reachable API; this does not run Playwright E2E tests):

```bash
CHAT_API_URL=https://api.yourdomain.com npm run test:all
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

| Event              | What Happens                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Open/Update PR** | Runs security checks, frontend/backend tests, build, and Terraform validation. No deployment or E2E run.   |
| **Push to `main`** | After validation passes, deploys to **DEV** and runs E2E, AI evaluation, and the configured security scan. |
| **Tag Push `v*`**  | Runs the **PROD** deployment workflow, followed by AI evaluation, E2E, and the configured security scan.   |

Production approval depends on the GitHub `prod` environment protection rules
configured in the repository; a tag push alone does not imply manual approval.

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
