# 🚀 Deployment Guide

Follow these steps in order to get CricScore running on your own AWS account.

> [!IMPORTANT]
> This is not a one-command deployment. AWS resources and external services (Aiven, OpenAI) may cost money. Deploy scripts apply changes automatically.

## Steps at a glance

| #   | Step                                    |
| --- | --------------------------------------- |
| 0   | Get accounts                            |
| 1   | Clone and install tools                 |
| 2   | Fill in `.env.local`                    |
| 3   | Bootstrap AWS, point DNS, verify email  |
| 4   | Deploy Dev (then Prod)                  |
| 5   | Sign in and make yourself admin         |
| 6   | (Optional) Turn on GitHub Actions CI/CD |

---

## Step 0: Get accounts

**Accounts / things to have ready**

- [ ] **AWS account**: [Sign up](https://portal.aws.amazon.com/billing/signup). Then create an **IAM user** (not root) at [IAM → Users](https://console.aws.amazon.com/iam/home#/users) → Security credentials → Create access key. Attach the `AdministratorAccess` policy to the user (simplest for a personal deploy). You paste the key into `.env.local` in Step 2.
- [ ] **Domain** you own: buy one at [Spaceship](https://www.spaceship.com), [Route 53](https://console.aws.amazon.com/route53/domains), [GoDaddy](https://www.godaddy.com) or [Cloudflare](https://www.cloudflare.com/products/registrar/) (any registrar that lets you set custom nameservers also works). The Route 53 hosted zone is created for you in Step 3
- [ ] **PostgreSQL**: [Aiven sign up](https://console.aiven.io/signup) → create a PostgreSQL service (free plan available) → copy its Service URI
- [ ] **Sender email**: an address on your domain, verified in [SES](https://console.aws.amazon.com/ses/home#/identities) in Step 3c
- [ ] **OpenAI API key** (chat and rulebook search): [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- [ ] **GitHub account** (only for Step 6): [github.com/signup](https://github.com/signup)

> [!WARNING]
> If a Route 53 hosted zone for your domain already exists, do **not** run bootstrap (Step 3). Ask for the import path in [terraform_guide.md](./terraform_guide.md).

## Step 1: Clone and install tools

```bash
git clone https://github.com/venkatesh-singamsetty/cricscore.git
cd cricscore
```

**Install tools**

Run the setup script from the repo root. It checks for and installs Node.js 24, Terraform, AWS CLI, `jq`, `gh`, Docker, the PostgreSQL client (`psql`) and security tools (Homebrew on macOS, `apt-get` on Linux):

```bash
./infra/scripts/setup.sh
```

On macOS, open Docker Desktop once after install so it is running.

---

## Step 2: Configure `.env.local`

**2a. Create the file and fill in the values**

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```bash
# AWS: the IAM user's access key ID and secret access key (Step 0)
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

# OpenAI (chat and embeddings)
OPENAI_API_KEY='your-openai-api-key'

# Optional: GitHub Personal Access Token for the MCP GitHub Issue Agent in Chat
# (See docs/github_issue_agent.md; Weather Report Agent via Open-Meteo is $0 and needs no key)
GITHUB_TOKEN='ghp_your_github_pat_here'
```

`LLM_BASE_URL` and `LLM_MODEL` are optional and default to `https://api.openai.com/v1` and `gpt-4o-mini`.

> [!CAUTION]
> Never commit `.env.local` to version control. It is in `.gitignore` by default.

**Naming (automatic).** With `ZONE_DOMAIN=example.org` and `SUBDOMAIN_PREFIX=cricscore`:

| Environment | URL                        | Resources prefix |
| ----------- | -------------------------- | ---------------- |
| Dev         | `cricscoredev.example.org` | `cricscoredev`   |
| Prod        | `cricscore.example.org`    | `cricscore`      |

> [!TIP]
> Always specify the base name in `.env.local` (e.g. `SUBDOMAIN_PREFIX='cricscore'`, not `'cricscoredev'`). The deploy script automatically appends `dev` for dev environments.

- `TF_STATE_BUCKET` is optional. By default it becomes `<PROJECT_NAME>-tfstate-<your AWS account ID>`. Set it only to reuse an existing bucket.
- Optional overrides: `DEV_DOMAIN_NAME`, `DEV_PROJECT_NAME`, `DEV_SUBDOMAIN_PREFIX` (and `PROD_*`).
- Optional Sentry: `cp apps/frontend/.env.example apps/frontend/.env` and set `VITE_SENTRY_DSN`.

**2b. Check everything**

```bash
./infra/scripts/deploy.sh --env dev --use-local-env --check
```

Every line must show ✅ before you continue. It changes nothing.

---

## Step 3: Bootstrap AWS (once only)

> [!WARNING]
> Run this once per new deployment. Keep `infra/terraform/bootstrap` (local state) safe. Never delete it.

**3a. Create the state bucket and DNS zone**

```bash
./infra/scripts/deploy.sh --env dev --use-local-env --bootstrap-only
```

Copy the 4 nameservers it prints.

**3b. Point your domain to AWS**

1. Log in to your domain registrar.
2. Replace the domain's nameservers with the 4 you copied.
3. Wait until DNS updates (minutes to hours). Check: `dig NS yourdomain.com +short`

**3c. Verify your sender email**

1. AWS Console → **SES** → **Verified identities** → **Create identity**.
2. Enter `yourdomain.com`. Add the DNS records shown (in Route 53).
3. Wait until the status says **Verified**.
4. New SES accounts are in sandbox: you can only email verified addresses. Verify your own address too, or request production access.

---

## Step 4: Deploy

**4a. Dev**

```bash
./infra/scripts/deploy.sh --env dev --use-local-env --migrate
```

The script then installs dependencies, runs DB migrations, applies Terraform, builds the frontend, uploads it to S3 and clears the CloudFront cache. At the end it prints your site URL, e.g. `https://cricscoredev.example.org`.

**4b. Check it works**

1. Open the printed URL (hard refresh if the page is blank; CloudFront can take ~5 minutes).
2. You should see the Viewer tab load.

**4c. Prod (only when Dev is good)**

Before you run it:

- [ ] Dev works (4b).
- [ ] The SES domain is verified (Step 3c). Prod uses the same domain.
- [ ] `TF_DATABASE_URL` points at the database you want. Dev and Prod share it and are separated by schema.
- [ ] `DOMAIN_NAME` (e.g. `cricscore.yourdomain.com`) is under your Route 53 zone.
- [ ] `./infra/scripts/deploy.sh --env prod --use-local-env --check` is all ✅.

```bash
./infra/scripts/deploy.sh --env prod --use-local-env --migrate
```

> [!CAUTION]
> The script runs `terraform apply -auto-approve` and `--migrate` changes the database **before** that. There is no dry run. See the [Terraform guide](./terraform_guide.md).

GitHub secrets are **not** needed for local deploys. They are only used by Step 6.

---

## Step 5: Sign in and make yourself admin

1. Open your live site and click **SCORER**.
2. Click **Create Account**, enter name, email and password, then confirm the emailed code.
3. Make yourself admin, using either option:
   - **Script:** `./infra/scripts/make_admin.sh --env dev you@email.com` (use `--env prod` for Prod).
   - **Console:** AWS Console → **Cognito** → **User pools** → your pool → **Groups** → **Admin** → **Add user to group** → select yourself.
4. Sign out and back in. The **Admin Panel** tab now appears.

---

## Step 6 (optional): GitHub Actions CI/CD

1. Log in (`gh` was installed in Step 1): `gh auth login`
2. Upload settings from `.env.local` **once** (this creates the `dev` and `prod` GitHub environments' secrets):

```bash
./infra/scripts/setup_github_envs.sh
```

> [!CAUTION]
> Run it once. Running again overwrites your GitHub secrets with whatever is in `.env.local`.

What happens afterwards:

| Event                       | Result                                                                                                                                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open/update PR              | Security checks (GitLeaks, Checkov, Trivy, CodeQL), unit/component tests, build, Terraform validate. No deploy.                                                                                                                                                 |
| Merge/Push to `main` (`CI`) | Deploys **Dev**, then runs AI evaluation, Playwright E2E against Dev, and OWASP ZAP baseline scan.                                                                                                                                                              |
| `CI` succeeds (`Release`)   | **Semantic Release** cuts the next `v*` tag, updates `docs/changelog.md`, and publishes concise GitHub Release notes (one line per PR title; PR bodies are intentionally excluded via `.releaserc.json` even though the squash-merge commit keeps the PR body). |
| Release published (`CD`)    | Deploys **Prod**, then runs AI evaluation, Playwright E2E against Prod, and OWASP ZAP scan.                                                                                                                                                                     |

Publishing a release (or pushing a `v*` tag) triggers **CD** for Prod. If you configure required reviewers under **GitHub → Settings → Environments → `prod`**, GitHub Actions will pause `CD` deployments until you review and approve them. Meanwhile, automated nightly drift detection (`drift.yml`) runs autonomously without human gates because it is strictly read-only (`terraform plan -detailed-exitcode`) and does not apply infrastructure changes.

---

## Optional: run the frontend locally

Needs a deployed backend (Step 4).

```bash
cd apps/frontend
npm run dev
```

> [!WARNING]
> `apps/frontend/.env` holds the URLs of the environment you last deployed. If that was Prod, local sign-ups create real Prod accounts.

Run all tests plus the chat evaluation (set `CHAT_API_URL` to the `http_api_url` Terraform output):

```bash
CHAT_API_URL='<http_api_url>' npm run test:all
```

---

## Central Platform & Artifacts Dashboard

After any dev or prod deployment, `./infra/scripts/deploy.sh` automatically refreshes the central platform dashboard by running `./infra/scripts/generate_platform_dashboard.sh`. This script inspects GitHub Actions workflows, repository variables/secrets inventory, live Terraform state from S3, S3 versioned ML model registry URIs (`s3://<bucket>/models/<version>/`), ECR container image digests, ML model metrics, and Aiven PostgreSQL schemas to generate [`docs/platform_dashboard.md`](./platform_dashboard.md).

You can also run it manually at any time to refresh all direct console deep links, GitHub resources, and artifact pointers:

```bash
./infra/scripts/generate_platform_dashboard.sh
```

### Deploying or Rolling Back a Specific ML Model Version Tag

Model artifacts (`live_win_predictor_model.joblib`, `model_manifest.json`, `live_metadata.json`) are stored by semantic version tag in S3 (`s3://<project>-match-backups-.../models/<version>/`) and tagged in ECR (`:<version>` + `:latest`). To deploy or roll back to a specific model version tag:

```bash
./infra/scripts/deploy.sh --env dev --use-local-env --model-version v2.2.0
./infra/scripts/deploy.sh --env prod --use-local-env --model-version v2.2.0
```

---

## Troubleshooting

See [troubleshooting.md](./troubleshooting.md) for solutions to common issues.

For quick checks:

- **Blank page**: wait 5 minutes, then hard-refresh.
- **Login fails**: confirm Terraform output has the Cognito User Pool and Client IDs.
- **No emails**: confirm the SES identity is Verified (and the recipient, if in sandbox).

---

© 2026 CricScore Documentation
