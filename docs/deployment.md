# 🚀 Deployment Guide

This is the full deployment reference for CricScore — from registering a domain to having a live, fully-featured cricket scoring platform running in the cloud.

> [!IMPORTANT]
> A fresh clone is not a one-command cloud deployment. You need accounts and configuration for AWS, a domain/Route 53, PostgreSQL, SES, and an OpenAI-compatible LLM provider. AWS resources and external database/provider services may incur costs.

## Fresh-clone path at a glance

1. Get the prerequisites in Step 0, then clone the repository.
2. Copy `.env.local.example` to `.env.local` and fill in **your own** values.
3. Run the one-time bootstrap command. Add its Route 53 nameservers at your registrar and verify your SES sender/domain.
4. After DNS is delegated, run the Dev deployment command with `--migrate`.
5. Sign in and grant your account the Cognito `Admin` group if you need admin access.

Follow the full steps below in order. The deploy script applies AWS changes automatically; review the configuration and target environment before running it.

---

## What You'll Build

- A **dev environment** (e.g., `cricscoredev.yourdomain.com`) for testing
- A **prod environment** (e.g., `cricscore.yourdomain.com`) for live matches
- CI validates pull requests; pushes to `main` can trigger the development deployment workflow.

---

## Step 0: Prerequisites and accounts

Install or configure the following before deployment:

- Node.js 24+, Terraform 1.10+, AWS CLI, Docker Engine, and PostgreSQL client (`psql`). Local deployment builds and pushes the ML inference Lambda image with Docker. The repository's `infra/scripts/setup.sh` can help install some tools; install Docker Desktop separately on macOS and make sure Docker is running.
- AWS credentials authorized to create the resources managed by Terraform. Prefer AWS CLI/role-based credentials for local use; avoid root credentials. Verify access with `aws sts get-caller-identity`.
- A domain you control. The bootstrap creates a Route 53 hosted zone for its root domain. Do **not** run bootstrap blindly if a hosted zone for this domain already exists; use/adopt the existing DNS configuration instead.
- An Aiven PostgreSQL service and its connection URI. Dev and prod use separate schemas (`dev` and `prod`) in the configured database by default. Back up existing data and use the correct database before running migrations.
- A verified SES sender/domain. SES sandbox accounts may only send to verified recipients.
- An OpenAI-compatible API key for chat. The current template also uses OpenAI credentials for embeddings; configure a provider and key that support the embedding endpoint/model.

## Step 1: Clone the repository

```bash
git clone https://github.com/venkatesh-singamsetty/cricscore.git
cd cricscore
```

Install the prerequisites listed above if they are not already available. `infra/scripts/setup.sh` is optional; it installs some development/security tools, but does not replace installing Docker Desktop on macOS or the PostgreSQL client (`psql`). Start Docker before deploying. Confirm the tools and AWS credentials are available:

```bash
node --version
terraform version
aws sts get-caller-identity
docker info
psql --version
```

GitHub Actions setup later also requires GitHub CLI (`gh`).

---

## Step 2: Configure Your Environment

### 2a. Root config — `.env.local`

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```bash
# AWS credentials: use AWS CLI/role credentials and leave these blank where possible,
# or fill in a dedicated deployment identity's credentials.
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_DEFAULT_REGION=us-east-1
TF_STATE_BUCKET='yourname-cricscore-terraform-state'

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

# Chat provider (OpenAI-compatible)
LLM_API_KEY='your-provider-api-key'
LLM_BASE_URL='https://api.openai.com/v1'

# Embeddings: provide an OpenAI key if using the default embedding configuration.
OPENAI_API_KEY='your-openai-api-key'
```

> [!CAUTION]
> Never commit `.env.local` to version control. It is in `.gitignore` by default.

### 2b. Configure domains and Terraform state

The deploy script reads `ZONE_DOMAIN`, `DOMAIN_NAME`, `SUBDOMAIN_PREFIX`, and `PROJECT_NAME` from `.env.local`. For example, with `ZONE_DOMAIN=example.org` and the base prefix/project name `cricscore`, Dev defaults to `cricscoredev.example.org`, `cricscoredev` resources, and Prod uses `cricscore.example.org`, `cricscore` resources. The deploy script verifies that each app domain is under the configured hosted zone. Set `DEV_DOMAIN_NAME`, `DEV_PROJECT_NAME`, or `DEV_SUBDOMAIN_PREFIX` to override Dev; use the matching `PROD_*` variables for Prod.

`TF_STATE_BUCKET` must be a globally unique S3 bucket name. The same value is used for bootstrap, local deployment, and the GitHub Actions environment. You no longer need to edit Terraform backend configuration or the environment `.tfvars` files.

The deploy script writes the generated API and Cognito settings to `apps/frontend/.env`. To enable optional Sentry crash reporting, create that file from `apps/frontend/.env.example` before deployment and set `VITE_SENTRY_DSN`.

---

## Step 3: Bootstrap — One-Time AWS Setup

This creates the S3 Terraform state bucket and a Route 53 hosted zone for your domain. **Run it once per new deployment only.** Bootstrap Terraform state is local under `infra/terraform/bootstrap`; keep it safe and do not delete it. Do not repeat bootstrap after losing that state or when you already have a hosted zone without first reviewing the import/adoption path.

### 3a. Create initial AWS resources

Run the bootstrap-only command; it creates the state bucket and Route 53 hosted zone, then prints the nameservers:

```bash
./infra/scripts/deploy.sh --env dev --use-local-env --bootstrap-only
```

### 3b. Point your domain to AWS

Add the printed nameservers at your domain registrar:

1. Log in to your domain registrar.
2. Replace the domain's nameservers with the Route 53 nameservers printed by the script.
3. Wait for DNS delegation to propagate; timing varies by registrar and DNS cache.

### 3c. Verify SES email

1. Go to **AWS Console → SES → Verified Identities → Create Identity**
2. Enter `yourdomain.com` and verify ownership via the DNS TXT record shown
3. Verify the sender identity used by the app. If the SES account is still in the sandbox, recipients must also be verified; request production access if the app needs to email unverified recipients.

---

## Step 4: Deploy

Run the canonical deploy script for your target environment:

```bash
# First and later development deployments (requires DNS delegation and SES verification)
./infra/scripts/deploy.sh --env dev --use-local-env --migrate

# Production is a separate, explicit operation
./infra/scripts/deploy.sh --env prod --use-local-env --migrate
```

The script automatically:

1. Installs frontend and Lambda dependencies
2. Initializes Terraform and applies AWS infrastructure
3. Reads the live API Gateway and WebSocket URLs from Terraform output
4. Rewrites the generated `VITE_*` entries in `apps/frontend/.env`
5. Builds the React app
6. Uploads to S3 and invalidates CloudFront cache

The local deploy script runs database migrations only when `--migrate` is supplied. Migrations run **before** Terraform apply, so confirm the database URL and environment are correct first. Use `prod` only when intentionally migrating the production schema. The GitHub deployment workflows run the corresponding migration step automatically.

After a successful local deploy, the script prints the deployed website URL.

Your app is live at the configured Dev domain, for example `https://cricscoredev.example.org`.

> [!CAUTION]
> The deploy script runs `terraform apply -auto-approve` and then publishes the frontend. It has no plan-only mode. Before deploying to Prod, review the plan for the exact production configuration (see [the Terraform guide](./terraform_guide.md)), verify the production database and SES settings, and confirm any destructive changes are intentional.

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
CHAT_API_URL='<your deployed HTTP API URL from Terraform output http_api_url>' npm run test:all
```

---

## Step 6: Automate with GitHub Actions (CI/CD)

### 6a. Upload your secrets to GitHub

The setup script reads `.env.local` and configures the GitHub `dev` and `prod` environments with the variables and secrets used by the workflows. It does not read `.tfvars` files:

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
