# 🚀 Deployment Guide

Step-by-step self-deployment tutorial to run CricScore (`dev` + `prod`) on your own AWS account (`~$1/month` combined AWS run rate).

> [!IMPORTANT]
> Deploy scripts apply infrastructure and database changes automatically (`terraform apply -auto-approve`). Total AWS cost for `dev` + `prod` combined is `~$1/month` (Route 53 hosted zone `$0.50/mo` + S3/ECR storage `~$0.50/mo`), guarded by a `$5/month` AWS Budget alert.

```mermaid
flowchart LR
    S0["Step 0: Accounts"] --> S1["Step 1: Clone & Tools"]
    S1 --> S2["Step 2: .env.local & Check"]
    S2 --> S3["Step 3: Bootstrap DNS & SES"]
    S3 --> S4["Step 4: Deploy Dev & Prod"]
    S4 --> S5["Step 5: Admin User"]
    S5 --> S6["Step 6: GitHub Actions CI/CD"]
```

## Steps at a glance

| #     | Step                        | Command / Action                                                       | Est. Time |
| :---- | :-------------------------- | :--------------------------------------------------------------------- | :-------- |
| **0** | Get accounts & keys         | AWS IAM user, Domain, Aiven PostgreSQL, SES email, OpenAI API key      | 10 min    |
| **1** | Clone and install tools     | `./infra/scripts/setup.sh`                                             | 5 min     |
| **2** | Configure `.env.local`      | `cp .env.local.example .env.local` + `--check`                         | 3 min     |
| **3** | Bootstrap AWS, DNS & SES    | `./infra/scripts/deploy.sh --env dev --use-local-env --bootstrap-only` | 10 min    |
| **4** | Deploy Dev (then Prod)      | `./infra/scripts/deploy.sh --env dev --use-local-env --migrate`        | 6 min     |
| **5** | Sign in & grant Admin       | `./infra/scripts/make_admin.sh --env dev you@email.com`                | 2 min     |
| **6** | Enable GitHub Actions CI/CD | `./infra/scripts/setup_github_envs.sh`                                 | 2 min     |

---

## Step 0: Get accounts

| Service                        | Required Setup                                                                                                                             | Where to Get It                                                                                                                                                  | Cost Tier                                  |
| :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------- |
| **AWS Account & IAM User**     | Create an IAM user (not root) with `AdministratorAccess` policy and generate an Access Key (`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`) | [IAM Console](https://console.aws.amazon.com/iam/home#/users)                                                                                                    | `~$1/mo` (`dev` + `prod` combined)         |
| **Custom Domain**              | Any domain registrar that allows custom nameservers (Route 53 hosted zone is created in Step 3)                                            | [Spaceship](https://www.spaceship.com), [Route 53](https://console.aws.amazon.com/route53/domains), [Cloudflare](https://www.cloudflare.com/products/registrar/) | Registrar fee + `$0.50/mo` Route 53 zone   |
| **PostgreSQL 16 (`pgvector`)** | Create a free PostgreSQL service and copy its Service URI (`postgres://avnadmin:...`)                                                      | [Aiven Console](https://console.aiven.io/signup)                                                                                                                 | Free Tier (`keepalive.yml` prevents sleep) |
| **Sender Email (SES)**         | An email address on your domain (`noreply@yourdomain.com`) verified in Step 3c                                                             | [AWS SES Console](https://console.aws.amazon.com/ses/home#/identities)                                                                                           | AWS Free Tier                              |
| **OpenAI API Key**             | API key for `gpt-4o-mini` chat and `text-embedding-3-small` RAG search                                                                     | [OpenAI Platform](https://platform.openai.com/api-keys)                                                                                                          | Pay-per-token (`~$0.0002`/query)           |
| **GitHub Account & PAT**       | Needed for Step 6 CI/CD and optional MCP GitHub Issue Agent                                                                                | [GitHub Settings](https://github.com/settings/tokens)                                                                                                            | Free                                       |

> [!WARNING]
> If a Route 53 hosted zone for your domain already exists, do **not** run `--bootstrap-only` in Step 3. Import or reuse your existing zone via [terraform_guide.md](./terraform_guide.md).

---

## Step 1: Clone and install tools

```bash
git clone https://github.com/venkatesh-singamsetty/cricscore.git
cd cricscore
./infra/scripts/setup.sh
```

| Tool Installed by `setup.sh`   | Version / Purpose                                                                       |
| :----------------------------- | :-------------------------------------------------------------------------------------- |
| **Node.js**                    | `v24` (Frontend React 19 Vite build + Node.js 24 Lambda packaging)                      |
| **Terraform**                  | `>= 1.10.0` (AWS Infrastructure as Code with native S3 state locking)                   |
| **AWS CLI v2**                 | Authenticates with AWS S3, CloudFront, ECR, Lambda, and Logs                            |
| **Docker**                     | Builds `linux/amd64` container image (`xgboost-cpu`, `~309 MB`) for `ml-predict` Lambda |
| **`psql` (PostgreSQL client)** | Executes idempotent SQL schema migrations (`infra/database/migrate.sh`)                 |
| **`jq` & `gh` (GitHub CLI)**   | JSON parsing and automated GitHub Environments configuration                            |

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

| Variable                            | Required? | Default / Auto-Derived Behavior                                                                               |
| :---------------------------------- | :-------- | :------------------------------------------------------------------------------------------------------------ |
| `SUBDOMAIN_PREFIX` / `PROJECT_NAME` | Yes       | Base name (`cricscore`). `deploy.sh` automatically appends `dev` (`cricscoredev`) when `--env dev` is passed. |
| `TF_STATE_BUCKET`                   | Optional  | Defaults to `<PROJECT_NAME>-tfstate-<AWS_ACCOUNT_ID>`. Set only to reuse an existing S3 bucket.               |
| `LLM_BASE_URL` / `LLM_MODEL`        | Optional  | Defaults to `https://api.openai.com/v1` and `gpt-4o-mini`.                                                    |
| `DEV_*` / `PROD_*` overrides        | Optional  | `DEV_DOMAIN_NAME`, `DEV_PROJECT_NAME`, `DEV_SUBDOMAIN_PREFIX` (and `PROD_*`) override auto-derived names.     |
| `VITE_SENTRY_DSN`                   | Optional  | Copy `cp apps/frontend/.env.example apps/frontend/.env` to enable Sentry browser telemetry.                   |

| Environment             | Auto-Derived Frontend URL             | Auto-Derived HTTP API                     | Auto-Derived WebSocket API             | Resource Prefix  |
| :---------------------- | :------------------------------------ | :---------------------------------------- | :------------------------------------- | :--------------- |
| **Dev** (`--env dev`)   | `https://cricscoredev.yourdomain.com` | `https://api.cricscoredev.yourdomain.com` | `wss://ws.cricscoredev.yourdomain.com` | `cricscoredev-*` |
| **Prod** (`--env prod`) | `https://cricscore.yourdomain.com`    | `https://api.cricscore.yourdomain.com`    | `wss://ws.cricscore.yourdomain.com`    | `cricscore-*`    |

> [!CAUTION]
> Never commit `.env.local` to git. It is ignored via `.gitignore` and enforced by pre-commit GitLeaks hooks.

### 2b. Run pre-flight verification check

```bash
./infra/scripts/deploy.sh --env dev --use-local-env --check
```

Every check (`node`, `terraform`, `aws`, `jq`, `docker`, `psql`, AWS credentials, Docker daemon, and required `.env.local` secrets) must print `✅` before continuing.

---

## Step 3: Bootstrap AWS (once only)

> [!WARNING]
> Run bootstrap **once** per AWS account. Preserve `infra/terraform/bootstrap/terraform.tfstate` locally.

### 3a. Provision S3 Terraform state bucket and Route 53 Hosted Zone

```bash
./infra/scripts/deploy.sh --env dev --use-local-env --bootstrap-only
```

### 3b. Delegate DNS and verify SES

| Sub-step                          | Action                                                                                                                          | Verification Command / Console Check      |
| :-------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------- |
| **1. Point Domain Nameservers**   | Copy the 4 Route 53 nameservers printed by `--bootstrap-only` and set them as custom nameservers at your domain registrar.      | `dig NS yourdomain.com +short`            |
| **2. Verify SES Domain Identity** | Open **AWS Console → SES → Verified identities → Create identity**, add `yourdomain.com`, and publish DKIM records to Route 53. | Status shows **Verified** in SES Console  |
| **3. Verify Recipient (Sandbox)** | While your AWS SES account is in sandbox mode, also verify your `ADMIN_EMAIL` address (or request SES production access).       | Recipient email status shows **Verified** |

---

## Step 4: Deploy

### 4a. Deploy Dev

```bash
./infra/scripts/deploy.sh --env dev --use-local-env --migrate
```

| Phase Automated by `deploy.sh`           | What Happens Under the Hood                                                                                                                                                                                                                |
| :--------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Database Migrations (`--migrate`)** | Runs `./infra/database/migrate.sh "$TF_DATABASE_URL" dev` to create/update tables and `pgvector` indexes in the `dev` schema.                                                                                                              |
| **2. Dependency Hydration**              | Installs frontend and production-only Node.js Lambda dependencies (`npm install --omit=dev`).                                                                                                                                              |
| **3. Terraform Init & Apply**            | Runs `terraform init -reconfigure -upgrade` and `terraform apply -auto-approve`, including building/pushing the `xgboost-cpu` (`~309 MB`) Docker image to ECR (`countNumber = 1` single-image retention) and uploading ML artifacts to S3. |
| **4. Log Retention Guardrail**           | Enforces **7-day retention** on all `/aws/lambda/cricscoredev-*` CloudWatch Log Groups.                                                                                                                                                    |
| **5. Frontend Build & CDN Sync**         | Injects Terraform outputs (`http_api_url`, `websocket_url`, Cognito IDs) into `apps/frontend/.env`, runs `npm run build`, syncs `dist/` to S3, and invalidates CloudFront (`/*`).                                                          |
| **6. Platform Dashboard Refresh**        | Runs `./infra/scripts/generate_platform_dashboard.sh` to refresh [`docs/platform_dashboard.md`](./platform_dashboard.md).                                                                                                                  |

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

| Step                                       | Action / Command                                                                                                    |
| :----------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| **1. Register Scorer Account**             | Open your live site → click **SCORER** → **Create Account** → verify the emailed confirmation code.                 |
| **2. Promote User to `Admin` Group (CLI)** | `./infra/scripts/make_admin.sh --env dev you@email.com`<br>`./infra/scripts/make_admin.sh --env prod you@email.com` |
| **3. Alternative (AWS Console)**           | **Cognito → User pools → `<project>-user-pool` → Groups → `Admin` → Add user to group**.                            |
| **4. Refresh Token**                       | Sign out and sign back in; the **Admin Panel** tab appears in the navigation bar.                                   |

---

## Step 6 (optional): GitHub Actions CI/CD

### 6a. Sync `.env.local` to GitHub Environments (`dev` and `prod`)

```bash
gh auth login
./infra/scripts/setup_github_envs.sh
```

> [!CAUTION]
> Run `setup_github_envs.sh` once during initial setup, or whenever rotating secrets in `.env.local`. It creates the `dev` and `prod` GitHub Environments and populates all environment secrets and variables. Also add `GH_PAT` (with `repo` and `workflow` scopes) as a repository secret for Semantic Release.

### 6b. Automated CI/CD Pipeline Behavior

| Event                            | Workflow      | Automated Actions                                                                                                                                                                                                                                                  |
| :------------------------------- | :------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pull Request to `main`**       | `ci.yml`      | 4 parallel validation jobs: `validate_security` (GitLeaks, Checkov), `validate_frontend` (Vitest, Trivy, Vite build), `validate_backend` (Lambda unit tests, Trivy, `terraform fmt` & `validate`), `validate_python` (AI & ML pytest, Trivy). No cloud deploy.     |
| **Push / Merge to `main`**       | `ci.yml`      | Runs all 4 validation jobs → `deploy_and_test_dev` (runs DB migrations, `terraform init -upgrade`, `terraform apply`, enforces 7-day Lambda log retention, deploys SPA to S3/CloudFront, and runs AI evals, 14 Playwright E2E tests, and OWASP ZAP baseline scan). |
| **`CI` Succeeds on `main`**      | `release.yml` | Runs **Semantic Release** using `GH_PAT`: calculates next `v*` tag from Conventional Commits, updates `docs/changelog.md`, publishes GitHub Release notes, and enriches PR overview via `enrich_release_notes.sh`.                                                 |
| **Release Published / `v*` Tag** | `cd.yml`      | Runs `deploy_and_test_prod` against `prod` environment (pauses for manual approval if GitHub Environment reviewers are configured), enforces 7-day log retention, and runs AI evals, Playwright E2E, and OWASP ZAP.                                                |
| **Nightly `00:00 UTC`**          | `drift.yml`   | Read-only `terraform plan -detailed-exitcode` across `dev` and `prod` without human gates; alerts on exit code `2` (drift).                                                                                                                                        |

---

## Optional: Local Development, Model Rollback & Dashboard

| Task                                | Command                                                                                                                                                       | Notes                                                                                              |
| :---------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------- |
| **Run Frontend Locally**            | `cd apps/frontend && npm run dev`                                                                                                                             | Uses endpoints in `apps/frontend/.env` from the last deployed environment.                         |
| **Run Full Local Test Suite**       | `CHAT_API_URL='<http_api_url>' npm run test:all`                                                                                                              | Runs frontend, backend, Python AI/ML tests, and live AI evaluation.                                |
| **Deploy / Roll Back ML Model Tag** | `./infra/scripts/deploy.sh --env dev --use-local-env --model-version v2.2.0`<br>`./infra/scripts/deploy.sh --env prod --use-local-env --model-version v2.2.0` | Deploys specific model version from S3 (`s3://<bucket>/models/<version>/`) and ECR (`:<version>`). |
| **Refresh Platform Dashboard**      | `./infra/scripts/generate_platform_dashboard.sh`                                                                                                              | Regenerates [`docs/platform_dashboard.md`](./platform_dashboard.md) with live AWS/GitHub/DB links. |

---

## Troubleshooting

See [troubleshooting.md](./troubleshooting.md) for comprehensive diagnostics.

| Symptom                           | Root Cause                                                            | Fix                                                                                     |
| :-------------------------------- | :-------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| **Blank page after first deploy** | CloudFront edge distribution or ACM DNS propagation still in progress | Wait 3–5 minutes and hard-refresh (`Cmd+Shift+R`).                                      |
| **Login / Sign-up fails**         | Stale Cognito Pool/Client IDs in `apps/frontend/.env`                 | Re-run `./infra/scripts/deploy.sh --env dev --use-local-env` to sync Terraform outputs. |
| **Scorecard email not received**  | SES account is in sandbox mode or domain DKIM is pending              | Verify both sender domain and recipient email in **AWS SES → Verified identities**.     |

---

© 2026 CricScore Documentation
