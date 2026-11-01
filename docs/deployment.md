# 🚀 Deployment Guide

Step-by-step self-deployment tutorial to run CricScore (`dev` + `prod`) on your own AWS account (`~$1/month` combined AWS run rate).

> [!IMPORTANT]
> Deploy scripts apply infrastructure and database changes automatically (`terraform apply -auto-approve`). Total AWS cost for `dev` + `prod` combined is `~$1/month` (Route 53 hosted zone `$0.50/mo` + S3/ECR storage `~$0.50/mo`), guarded by a `$5/month` AWS Budget alert.

```mermaid
flowchart TD
    S0["Step 0: Accounts & Keys"] --> S1["Step 1: Clone & Tools"]
    S1 --> S2["Step 2: .env.local & Pre-Flight Check"]
    S2 --> S3["Step 3: Bootstrap S3, Route 53 & OIDC"]
    S3 --> S4["Step 4: Deploy Dev & Prod"]
    S4 --> S5["Step 5: Grant Admin User"]
    S5 --> S6["Step 6: GitHub Actions CI/CD"]
```

## Steps at a glance

```bash
# Step 1: Clone repository and install prerequisite tools
./infra/scripts/setup.sh

# Step 2: Validate local environment configuration and secrets
./infra/scripts/deploy.sh --env dev --use-local-env --check

# Step 3a: Bootstrap AWS S3 state bucket and Route 53 (run once per account)
./infra/scripts/deploy.sh --env dev --use-local-env --bootstrap-only

# Step 3b: Point registrar nameservers to Route 53 and verify SES domain in AWS Console

# Step 3c: Bootstrap keyless GitHub Actions OIDC (run once per account/repo)
gh auth login
./infra/scripts/bootstrap_oidc.sh

# Step 4: Deploy full stack with database migrations to Dev
./infra/scripts/deploy.sh --env dev --use-local-env --migrate

# Step 5: Grant Admin role to your registered user in Dev
./infra/scripts/make_admin.sh --env dev you@email.com

# Step 6: Synchronize secrets and variables to GitHub Environments
./infra/scripts/setup_github_envs.sh
```

---

## Step 0: Get accounts

- **AWS Account & IAM ([IAM Console](https://console.aws.amazon.com/iam/home#/users)):**
  - Create an IAM user (not root) with the `AdministratorAccess` policy and generate an Access Key ID + Secret.
  - **Cost Tier:** `~$1/month` (`dev` + `prod` combined).
- **Custom Domain:**
  - Register a domain with any registrar that supports custom nameservers (such as [Spaceship](https://www.spaceship.com), [Amazon Route 53](https://console.aws.amazon.com/route53/domains), or [Cloudflare](https://www.cloudflare.com/products/registrar/)).
  - **Cost Tier:** Registrar fee + `$0.50/mo` Route 53 hosted zone.
- **PostgreSQL 16 ([Aiven Console](https://console.aiven.io/signup)):**
  - Create a free PostgreSQL 16 service (`pgvector` included) and copy the Service URI (`postgres://avnadmin:...`).
  - **Strict SSL CA (Optional but Recommended):** Download the Project CA certificate (Overview → CA Certificate → Download) and save it to `infra/database/certs/aiven-ca.pem` for zero-cost strict TLS verification.
  - **Cost Tier:** Free Tier (`keepalive.yml` runs 1 daily Production E2E match + 7-match retention to prevent inactivity sleep).
- **Sender Email — Amazon SES ([AWS SES Console](https://console.aws.amazon.com/ses/home#/identities)):**
  - Choose a sender email address on your custom domain (`noreply@yourdomain.com`), verified in Step 3b.
  - **Cost Tier:** AWS Free Tier.
- **OpenAI API Key ([OpenAI Platform](https://platform.openai.com/api-keys)):**
  - Create an API key for `gpt-4o-mini` agentic chat and `text-embedding-3-small` rulebook RAG search.
  - **Cost Tier:** Pay-per-token (`~$0.0002`/query).
- **GitHub Account ([GitHub Settings](https://github.com/settings/tokens)):**
  - Used for Step 6 CI/CD automation and an optional PAT for the MCP GitHub Issue Agent in chat.
  - **Cost Tier:** Free.

> [!WARNING]
> If a Route 53 hosted zone for your domain already exists, do **not** run `--bootstrap-only` in Step 3. Import or reuse your existing zone via [terraform_guide.md](./terraform_guide.md).

---

## Step 1: Clone and install tools

```bash
git clone https://github.com/venkatesh-singamsetty/cricscore.git
cd cricscore
./infra/scripts/setup.sh
```

`setup.sh` verifies or installs:

- **Node.js `v24`** (React 19 Vite build + Node.js 24 Lambda packaging)
- **Terraform `>= 1.10.0`** (AWS Infrastructure as Code with native S3 state locking)
- **AWS CLI v2**, **`psql` client**, **`jq`**, and **GitHub CLI (`gh`)**
- **Docker** (builds the `linux/amd64` `xgboost-cpu ~309 MB` container image for `ml-predict` Lambda)

> [!NOTE]
> On macOS, open **Docker Desktop** once after installation so the Docker daemon is running before Step 2b.

---

## Step 2: Configure `.env.local`

### 2a. Copy template and populate variables

```bash
cp .env.local.example .env.local
```

```bash
# AWS IAM deployment credentials (from Step 0)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_DEFAULT_REGION=us-east-1

# Aiven PostgreSQL connection string (shared DB; isolated by dev/prod schemas)
TF_DATABASE_URL='postgres://avnadmin:PASSWORD@HOST:PORT/defaultdb?sslmode=require'

# Amazon SES verified sender address & Admin BCC recipient
TF_SES_SOURCE_EMAIL='noreply@yourdomain.com'
ADMIN_EMAIL='you@youremail.com'

# Base domain and naming (deploy.sh automatically derives dev & prod prefixes)
DOMAIN_NAME='cricscore.yourdomain.com'
ZONE_DOMAIN='yourdomain.com'
SUBDOMAIN_PREFIX='cricscore'
PROJECT_NAME='cricscore'

# OpenAI key for Chat Assistant & Rulebook RAG
OPENAI_API_KEY='your-openai-api-key'

# Optional: GitHub PAT for the MCP GitHub Issue Agent in Chat (Weather Agent uses Open-Meteo for free)
GITHUB_TOKEN='ghp_your_github_pat_here'
```

| Variable           | Required | Default / Behavior                                                         |
| :----------------- | :------- | :------------------------------------------------------------------------- |
| `SUBDOMAIN_PREFIX` | Yes      | Base prefix (`cricscore`; auto-derives `cricscoredev` in `dev`)            |
| `PROJECT_NAME`     | Yes      | Base resource prefix (`cricscoredev` in `dev`, `cricscore` in `prod`)      |
| `TF_STATE_BUCKET`  | Optional | `<PROJECT_NAME>-tfstate-<AWS_ACCOUNT_ID>`                                  |
| `LLM_BASE_URL`     | Optional | `https://api.openai.com/v1`                                                |
| `LLM_MODEL`        | Optional | `gpt-4o-mini`                                                              |
| `DEV_*` / `PROD_*` | Optional | Override auto-derived `DOMAIN_NAME`, `PROJECT_NAME`, or `SUBDOMAIN_PREFIX` |
| `VITE_SENTRY_DSN`  | Optional | Set in `apps/frontend/.env` for optional Sentry browser telemetry          |

- **Auto-Derived Environment Endpoints:**
  - **Dev (`--env dev`, prefix `cricscoredev-*`):**
    - Web App: `https://cricscoredev.yourdomain.com`
    - HTTP REST API: `https://api.cricscoredev.yourdomain.com`
    - WebSocket API: `wss://ws.cricscoredev.yourdomain.com`
  - **Prod (`--env prod`, prefix `cricscore-*`):**
    - Web App: `https://cricscore.yourdomain.com`
    - HTTP REST API: `https://api.cricscore.yourdomain.com`
    - WebSocket API: `wss://ws.cricscore.yourdomain.com`

> [!CAUTION]
> Never commit `.env.local` to git. It is ignored via `.gitignore` and enforced by pre-commit GitLeaks hooks.

### 2b. Run pre-flight verification check

```bash
./infra/scripts/deploy.sh --env dev --use-local-env --check
```

Every check (`node`, `terraform`, `aws`, `jq`, `docker`, `psql`, AWS credentials, Docker daemon, and required `.env.local` secrets) must print `✅` before continuing.

---

## Step 3: One-Time AWS Account Bootstrap (once per account)

> [!WARNING]
> Run bootstrap **once** per AWS account using local administrator AWS credentials (`user/venky`). This provisions foundational account singletons: the remote Terraform state bucket, DynamoDB lock table, Route 53 hosted zone, and GitHub Actions OIDC IAM federation.

### 3a. Provision S3 State Bucket, DynamoDB Lock Table & Route 53 Hosted Zone

```bash
./infra/scripts/deploy.sh --env dev --use-local-env --bootstrap-only
```

### 3b. Delegate DNS Nameservers and Verify SES

1. **Point Nameservers:**
   - Copy the 4 Route 53 nameservers printed by `--bootstrap-only` and set them as custom nameservers at your domain registrar.
   - **Verify:** Run `dig NS yourdomain.com +short`.
2. **Verify SES Domain:**
   - Open **AWS Console → SES → Verified identities → Create identity**, add `yourdomain.com`, and publish DKIM records to Route 53.
   - **Verify:** Status shows **Verified** in the SES Console.
3. **Verify Sandbox User (or Request Production Access):**
   - While your AWS SES account is in sandbox mode, verify your `ADMIN_EMAIL` address in SES, or request SES production access for open delivery.
   - **Verify:** Recipient email status shows **Verified**.

### 3c. Bootstrap Keyless GitHub Actions OIDC (IAM Role & STS Federation)

To eliminate long-lived static `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` credentials in GitHub Actions, bootstrap the IAM OpenID Connect Provider and GitHub deployment role:

1. **Authenticate GitHub CLI:**
   ```bash
   gh auth login
   ```
2. **Run OIDC Bootstrapper:**
   ```bash
   ./infra/scripts/bootstrap_oidc.sh
   ```

What `bootstrap_oidc.sh` executes:

1. Idempotently creates the AWS IAM OpenID Connect Provider for `https://token.actions.githubusercontent.com`.
2. Automatically detects your GitHub repository via `gh repo view` and creates the IAM Role `cricscore-github-actions-role` with a trust policy restricting role assumption strictly to your repository (`repo:<your-github-username>/<your-repo-name>:*`).
3. Attaches `AdministratorAccess` policy to the role.
4. Automatically populates `vars.AWS_ROLE_ARN` in GitHub across repository and environment scopes (`dev` and `prod`).

---

## Step 4: Deploy

### 4a. Deploy Dev

```bash
./infra/scripts/deploy.sh --env dev --use-local-env --migrate
```

What `deploy.sh` executes under the hood:

1. **DB Migrations (`infra/database/migrate.sh`):**
   - Runs `./infra/database/migrate.sh "$TF_DATABASE_URL" dev` to create or update tables and `pgvector` indexes in the `dev` schema.
2. **Dependency Hydration:**
   - Installs frontend dependencies and production-only Node.js Lambda dependencies (`npm install --omit=dev`).
3. **Terraform Apply:**
   - Runs `terraform init -reconfigure -upgrade` and `terraform apply -auto-approve`.
   - Builds and pushes the `xgboost-cpu ~309 MB` container image to ECR (`countNumber = 1`) and uploads XGBoost v2.2.0 ML artifacts to S3.
4. **Log Retention:**
   - Enforces **7-day retention** on all `/aws/lambda/cricscoredev-*` CloudWatch Log Groups.
5. **Frontend & CDN Sync:**
   - Injects Terraform outputs (`http_api_url`, `websocket_url`, Cognito IDs) into `apps/frontend/.env`.
   - Runs `npm run build`, syncs `dist/` to S3, and invalidates CloudFront (`/*`).
6. **Dashboard Refresh:**
   - Runs `./infra/scripts/generate_platform_dashboard.sh` to refresh [`docs/platform_dashboard.md`](./platform_dashboard.md).

### 4b. Verify Dev

Open the printed URL (`https://cricscoredev.yourdomain.com`). Hard-refresh if CloudFront SSL propagation takes ~3–5 minutes.

### 4c. Deploy Prod

```bash
# 1. Pre-flight check for prod
./infra/scripts/deploy.sh --env prod --use-local-env --check

# 2. Deploy prod infrastructure, migrations, ML container, and SPA
./infra/scripts/deploy.sh --env prod --use-local-env --migrate
```

---

## Step 5: Sign in and make yourself admin

1. **Register Account:** Open your live site → click **SCORER** → **Create Account** and verify the emailed confirmation code.
2. **Promote User via CLI (or AWS Cognito Console → Groups → `Admin`):**
   ```bash
   ./infra/scripts/make_admin.sh --env dev you@email.com
   ./infra/scripts/make_admin.sh --env prod you@email.com
   ```
3. **Refresh Token:** Sign out and sign back in so the **Admin Panel** tab appears in the top navigation bar.

---

## Step 6 (optional): GitHub Actions CI/CD

### 6a. Sync `.env.local` to GitHub Environments (`dev` and `prod`)

```bash
gh auth login
./infra/scripts/setup_github_envs.sh
```

> [!TIP]
> If you bootstrapped OIDC in Step 3c (`./infra/scripts/bootstrap_oidc.sh`), `AWS_ROLE_ARN` is already configured in GitHub. You can safely delete legacy static `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` secrets from GitHub Settings!

### 6b. Automated CI/CD Pipeline Behavior

- **Pull Request to `main` (`ci.yml`):**
  - Runs 4 parallel validation jobs (`376` unit tests total): `validate_security` (GitLeaks + Checkov), `validate_frontend` (Vitest + Trivy + Vite build), `validate_backend` (Lambda unit tests + Trivy + Terraform `fmt`/`validate`), and `validate_python` (AI & ML pytest + Trivy, no cloud deploy).
- **Push / Merge to `main` (`ci.yml`):**
  - Runs all 4 validation jobs (`376` unit tests) followed by `deploy_and_test_dev`: DB migrations, `terraform init -upgrade` & `apply`, 7-day log retention, and S3/CloudFront sync.
  - Executes live AI evals, `15` Playwright E2E tests, and OWASP ZAP baseline scan.
- **`CI` Succeeds on `main` (`release.yml`):**
  - Runs **Semantic Release** using `GH_PAT` to calculate the next `v*` tag from Conventional Commits.
  - Updates `docs/changelog.md`, publishes GitHub Release notes, and enriches PR overview via `enrich_release_notes.sh`.
- **Release Published (`v*` tag) (`cd.yml`):**
  - Runs `deploy_and_test_prod` against the `prod` environment (supports optional manual approval gate).
  - Enforces 7-day Lambda log retention, deploys SPA to S3/CloudFront, and runs live AI evals, `15` Playwright E2E tests, and OWASP ZAP scan.
- **Nightly `00:00 UTC` (`drift.yml`):**
  - Runs read-only `terraform plan -detailed-exitcode` exclusively against `prod` pinned to the latest release tag without human gates, alerting immediately via GitHub Actions on exit code `2` (out-of-band AWS drift). Excludes `dev` from scheduled runs to avoid false positives during active feature development.

---

## Optional: Local Development, Model Rollback & Dashboard

- **Run Frontend Locally:**
  - **Command:** `cd apps/frontend && npm run dev`
  - Uses endpoints in `apps/frontend/.env` from the last deployed environment.
- **Run Full Test Suite:**
  - **Command:** `CHAT_API_URL='<http_api_url>' npm run test:all`
  - Runs `376` unit tests (Frontend, Backend, Python AI/ML) plus the live AI evaluation suite and `15` E2E tests.
- **Deploy / Roll Back ML Model (`XGBoost v2.2.0`):**
  - **Dev Command:** `./infra/scripts/deploy.sh --env dev --use-local-env --model-version v2.2.0`
  - **Prod Command:** `./infra/scripts/deploy.sh --env prod --use-local-env --model-version v2.2.0`
  - Deploys the specified `XGBoost v2.2.0` model tag from S3 (`s3://<bucket>/models/<version>/`) and updates ECR (`:<tag>`).
- **Refresh Platform Dashboard:**
  - **Command:** `./infra/scripts/generate_platform_dashboard.sh`
  - Regenerates [`docs/platform_dashboard.md`](./platform_dashboard.md) with live AWS, GitHub, and DB links.

---

## Troubleshooting

See [troubleshooting.md](./troubleshooting.md) for comprehensive diagnostics.

- **Blank page on 1st deploy:**
  - **Cause:** CloudFront edge distribution or ACM DNS propagation still in progress.
  - **Fix:** Wait 3–5 minutes and hard-refresh your browser (`Cmd+Shift+R`).
- **Login / Sign-up fails:**
  - **Cause:** Stale Cognito Pool/Client IDs in `apps/frontend/.env`.
  - **Fix:** Re-run `./infra/scripts/deploy.sh --env dev --use-local-env` to sync Terraform outputs.
- **Scorecard email missing:**
  - **Cause:** SES account is in sandbox mode or domain DKIM verification is pending.
  - **Fix:** Verify both sender domain and recipient email in **AWS SES → Verified identities**.

---

© 2026 CricScore Documentation
