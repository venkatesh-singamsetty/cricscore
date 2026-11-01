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

| #     | Step                    | Command / Action                                                                                    | Est. Time |
| :---- | :---------------------- | :-------------------------------------------------------------------------------------------------- | :-------- |
| **0** | **Get accounts & keys** | • AWS IAM user & Custom Domain<br/>• Aiven PostgreSQL & SES email<br/>• OpenAI API key & GitHub PAT | 10 min    |
| **1** | **Clone & tools**       | `./infra/scripts/setup.sh`                                                                          | 5 min     |
| **2** | **Configure `.env`**    | • `cp .env.local.example .env.local`<br/>• Run `./infra/scripts/deploy.sh --check`                  | 3 min     |
| **3** | **Bootstrap AWS**       | `./infra/scripts/deploy.sh --env dev --use-local-env --bootstrap-only`                              | 10 min    |
| **4** | **Deploy Dev & Prod**   | `./infra/scripts/deploy.sh --env dev --use-local-env --migrate`                                     | 6 min     |
| **5** | **Grant Admin**         | `./infra/scripts/make_admin.sh --env dev you@email.com`                                             | 2 min     |
| **6** | **GitHub Actions CI**   | `./infra/scripts/setup_github_envs.sh`                                                              | 2 min     |

---

## Step 0: Get accounts

| Service                | Required Setup                                                                                             | Where to Get It                                                                                                                                                              | Cost Tier                                        |
| :--------------------- | :--------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------- |
| **AWS Account & IAM**  | • Create an IAM user (not root) with `AdministratorAccess` policy<br/>• Generate an Access Key ID + Secret | [IAM Console](https://console.aws.amazon.com/iam/home#/users)                                                                                                                | • `~$1/mo` (`dev` + `prod` combined)             |
| **Custom Domain**      | • Any domain registrar allowing custom nameservers<br/>• Route 53 hosted zone is created in Step 3         | • [Spaceship](https://www.spaceship.com)<br/>• [Route 53](https://console.aws.amazon.com/route53/domains)<br/>• [Cloudflare](https://www.cloudflare.com/products/registrar/) | • Registrar fee<br/>• `$0.50/mo` Route 53 zone   |
| **PostgreSQL 16**      | • Create a free PostgreSQL service with `pgvector`<br/>• Copy Service URI (`postgres://avnadmin:...`)      | [Aiven Console](https://console.aiven.io/signup)                                                                                                                             | • Free Tier<br/>• `keepalive.yml` prevents sleep |
| **Sender Email (SES)** | • Email address on your domain (`noreply@yourdomain.com`)<br/>• Verified in Step 3b                        | [AWS SES Console](https://console.aws.amazon.com/ses/home#/identities)                                                                                                       | • AWS Free Tier                                  |
| **OpenAI API Key**     | • API key for `gpt-4o-mini` chat<br/>• Powers `text-embedding-3-small` RAG search                          | [OpenAI Platform](https://platform.openai.com/api-keys)                                                                                                                      | • Pay-per-token (`~$0.0002`/query)               |
| **GitHub Account**     | • Needed for Step 6 CI/CD automation<br/>• Optional PAT for MCP GitHub Issue Agent                         | [GitHub Settings](https://github.com/settings/tokens)                                                                                                                        | • Free                                           |

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
- **Docker** (builds the `linux/amd64` `xgboost-cpu` `~309 MB` container image for `ml-predict` Lambda)

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

| Variable                   | Required? | Default / Auto-Derived Behavior                                                                                     |
| :------------------------- | :-------- | :------------------------------------------------------------------------------------------------------------------ |
| **`SUBDOMAIN_PREFIX`**     | Yes       | • Base name (`cricscore`)<br/>• `deploy.sh` automatically appends `dev` (`cricscoredev`) when `--env dev` is passed |
| **`PROJECT_NAME`**         | Yes       | • Base project prefix (`cricscore`)<br/>• Derives `cricscoredev` for `dev` and `cricscore` for `prod`               |
| **`TF_STATE_BUCKET`**      | Optional  | • Defaults to `<PROJECT_NAME>-tfstate-<AWS_ACCOUNT_ID>`<br/>• Set only to reuse an existing S3 bucket               |
| **`LLM_BASE_URL` / Model** | Optional  | • `LLM_BASE_URL` defaults to `https://api.openai.com/v1`<br/>• `LLM_MODEL` defaults to `gpt-4o-mini`                |
| **`DEV_*` / `PROD_*`**     | Optional  | • `DEV_DOMAIN_NAME`, `DEV_PROJECT_NAME`, `DEV_SUBDOMAIN_PREFIX`<br/>• Override auto-derived environment names       |
| **`VITE_SENTRY_DSN`**      | Optional  | • Copy `cp apps/frontend/.env.example apps/frontend/.env`<br/>• Enables optional Sentry browser telemetry           |

- **Auto-Derived Environment Endpoints:**
  - **Dev (`--env dev`, prefix `cricscoredev-*`):** `https://cricscoredev.yourdomain.com` · `https://api.cricscoredev.yourdomain.com` · `wss://ws.cricscoredev.yourdomain.com`
  - **Prod (`--env prod`, prefix `cricscore-*`):** `https://cricscore.yourdomain.com` · `https://api.cricscore.yourdomain.com` · `wss://ws.cricscore.yourdomain.com`

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

| Sub-step                   | Action                                                                                                                                      | Verification Check                        |
| :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ | :---------------------------------------- |
| **1. Point Nameservers**   | • Copy the 4 Route 53 nameservers printed by `--bootstrap-only`<br/>• Set them as custom nameservers at your domain registrar               | `dig NS yourdomain.com +short`            |
| **2. Verify SES Domain**   | • Open **AWS Console → SES → Verified identities → Create identity**<br/>• Add `yourdomain.com` and publish DKIM records to Route 53        | Status shows **Verified** in SES Console  |
| **3. Verify Sandbox User** | • While your AWS SES account is in sandbox mode, verify your `ADMIN_EMAIL` address<br/>• Or request SES production access for open delivery | Recipient email status shows **Verified** |

---

## Step 4: Deploy

### 4a. Deploy Dev

```bash
./infra/scripts/deploy.sh --env dev --use-local-env --migrate
```

| Phase                       | What Happens Under the Hood                                                                                                                                                                       |
| :-------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. DB Migrations**        | • Runs `./infra/database/migrate.sh "$TF_DATABASE_URL" dev`<br/>• Creates/updates tables and `pgvector` indexes in the `dev` schema                                                               |
| **2. Dependency Hydration** | • Installs frontend dependencies<br/>• Installs production-only Node.js Lambda dependencies (`npm install --omit=dev`)                                                                            |
| **3. Terraform Apply**      | • Runs `terraform init -reconfigure -upgrade` and `terraform apply -auto-approve`<br/>• Builds/pushes `xgboost-cpu` (`~309 MB`) image to ECR (`countNumber = 1`)<br/>• Uploads ML artifacts to S3 |
| **4. Log Retention**        | • Enforces **7-day retention** on all `/aws/lambda/cricscoredev-*` CloudWatch Log Groups                                                                                                          |
| **5. Frontend & CDN Sync**  | • Injects Terraform outputs (`http_api_url`, `websocket_url`, Cognito IDs) into `apps/frontend/.env`<br/>• Runs `npm run build`, syncs `dist/` to S3, and invalidates CloudFront (`/*`)           |
| **6. Dashboard Refresh**    | • Runs `./infra/scripts/generate_platform_dashboard.sh`<br/>• Refreshes [`docs/platform_dashboard.md`](./platform_dashboard.md)                                                                   |

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

> [!CAUTION]
> Run `setup_github_envs.sh` once during initial setup, or whenever rotating secrets in `.env.local`. It creates the `dev` and `prod` GitHub Environments and populates all environment secrets and variables. Also add `GH_PAT` (with `repo` and `workflow` scopes) as a repository secret for Semantic Release.

### 6b. Automated CI/CD Pipeline Behavior

| Event                        | Workflow      | Automated Actions                                                                                                                                                                                                                                   |
| :--------------------------- | :------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pull Request to `main`**   | `ci.yml`      | • `validate_security`: GitLeaks + Checkov<br/>• `validate_frontend`: Vitest + Trivy + Vite build<br/>• `validate_backend`: Lambda unit tests + Trivy + Terraform `fmt`/`validate`<br/>• `validate_python`: AI & ML pytest + Trivy (no cloud deploy) |
| **Push / Merge to `main`**   | `ci.yml`      | • Runs all 4 validation jobs (`376` unit tests total)<br/>• Runs `deploy_and_test_dev`: DB migrations, `terraform init -upgrade` & `apply`, 7-day log retention, and S3/CloudFront sync<br/>• Runs AI evals, 14 Playwright E2E tests, and OWASP ZAP |
| **`CI` Succeeds on `main`**  | `release.yml` | • Runs **Semantic Release** using `GH_PAT` to calculate next `v*` tag from Conventional Commits<br/>• Updates `docs/changelog.md` and publishes GitHub Release notes<br/>• Enriches PR overview via `enrich_release_notes.sh`                       |
| **Release Published (`v*`)** | `cd.yml`      | • Runs `deploy_and_test_prod` against `prod` environment (supports optional manual approval gate)<br/>• Enforces 7-day Lambda log retention and deploys SPA to S3/CloudFront<br/>• Runs live AI evals, Playwright E2E, and OWASP ZAP scan           |
| **Nightly `00:00 UTC`**      | `drift.yml`   | • Runs read-only `terraform plan -detailed-exitcode` across `dev` and `prod` without human gates<br/>• Alerts immediately on exit code `2` (out-of-band AWS drift)                                                                                  |

---

## Optional: Local Development, Model Rollback & Dashboard

| Task                      | Command                                                                                                                                                            | Notes                                                                                                                  |
| :------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------- |
| **Run Frontend Locally**  | `cd apps/frontend && npm run dev`                                                                                                                                  | • Uses endpoints in `apps/frontend/.env` from the last deployed environment                                            |
| **Run Full Test Suite**   | `CHAT_API_URL='<http_api_url>' npm run test:all`                                                                                                                   | • Runs `376` unit tests (Frontend, Backend, Python AI/ML)<br/>• Executes live AI evaluation suite                      |
| **Deploy / Roll Back ML** | • `./infra/scripts/deploy.sh --env dev --use-local-env --model-version v2.2.0`<br/>• `./infra/scripts/deploy.sh --env prod --use-local-env --model-version v2.2.0` | • Deploys specific XGBoost `v2.2.0` model tag from S3 (`s3://<bucket>/models/<version>/`)<br/>• Updates ECR (`:<tag>`) |
| **Refresh Dashboard**     | `./infra/scripts/generate_platform_dashboard.sh`                                                                                                                   | • Regenerates [`docs/platform_dashboard.md`](./platform_dashboard.md) with live AWS, GitHub, and DB links              |

---

## Troubleshooting

See [troubleshooting.md](./troubleshooting.md) for comprehensive diagnostics.

| Symptom                      | Root Cause                                                                 | Fix                                                                                      |
| :--------------------------- | :------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| **Blank page on 1st deploy** | • CloudFront edge distribution or ACM DNS propagation still in progress    | • Wait 3–5 minutes<br/>• Hard-refresh browser (`Cmd+Shift+R`)                            |
| **Login / Sign-up fails**    | • Stale Cognito Pool/Client IDs in `apps/frontend/.env`                    | • Re-run `./infra/scripts/deploy.sh --env dev --use-local-env` to sync Terraform outputs |
| **Scorecard email missing**  | • SES account is in sandbox mode<br/>• Or domain DKIM verification pending | • Verify both sender domain and recipient email in **AWS SES → Verified identities**     |

---

© 2026 CricScore Documentation
