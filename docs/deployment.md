# 🚀 Deployment Guide

Follow these steps in order to get CricScore running on your own AWS account.

> [!IMPORTANT]
> This is not a one-command deployment. AWS resources and external services (Aiven, OpenAI) may cost money. Deploy scripts apply changes automatically.

## Steps at a glance

| #   | Step                                    | Time              |
| --- | --------------------------------------- | ----------------- |
| 0   | Get accounts and install tools          | 30 min            |
| 1   | Clone and check tools                   | 2 min             |
| 2   | Fill in `.env.local`                    | 10 min            |
| 3   | Bootstrap AWS, point DNS, verify email  | 15 min + DNS wait |
| 4   | Deploy Dev (then Prod)                  | 15 min            |
| 5   | Sign in and make yourself admin         | 5 min             |
| 6   | (Optional) Turn on GitHub Actions CI/CD | 10 min            |

---

## Step 0: Get accounts and install tools

**Accounts / things to have ready**

- [ ] **AWS account**: [Sign up](https://portal.aws.amazon.com/billing/signup). Then create an **IAM user** (not root) at [IAM → Users](https://console.aws.amazon.com/iam/home#/users) → Security credentials → Create access key. Run `aws configure` with it, then check: `aws sts get-caller-identity`
- [ ] **Domain** you own: buy one at [Spaceship](https://www.spaceship.com), [Route 53](https://console.aws.amazon.com/route53/domains), [GoDaddy](https://www.godaddy.com) or [Cloudflare](https://www.cloudflare.com/products/registrar/) (any registrar that lets you set custom nameservers also works). The Route 53 hosted zone is created for you in Step 3
- [ ] **PostgreSQL**: [Aiven sign up](https://console.aiven.io/signup) → create a PostgreSQL service (free plan available) → copy its Service URI
- [ ] **Sender email**: an address on your domain, verified in [SES](https://console.aws.amazon.com/ses/home#/identities) in Step 3c
- [ ] **OpenAI API key** (chat and rulebook search): [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- [ ] **GitHub account** (only for Step 6): [github.com/signup](https://github.com/signup)

**Tools to install**

- [ ] [Node.js 24+](https://nodejs.org)
- [ ] [Terraform 1.10+](https://developer.hashicorp.com/terraform/install)
- [ ] [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [ ] [Docker](https://docs.docker.com/get-docker/) (Docker Desktop on macOS). **Start it.**
- [ ] PostgreSQL client (`psql`): [postgresql.org/download](https://www.postgresql.org/download/)
- [ ] [GitHub CLI (`gh`)](https://cli.github.com), only for Step 6

> [!WARNING]
> If a Route 53 hosted zone for your domain already exists, do **not** run bootstrap (Step 3). Ask for the import path in [terraform_guide.md](./terraform_guide.md).

## Step 1: Clone and check tools

```bash
git clone https://github.com/venkatesh-singamsetty/cricscore.git
cd cricscore

node --version
terraform version
aws sts get-caller-identity
docker info
psql --version
```

All five commands must succeed before you continue.

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

# OpenAI (chat and embeddings)
OPENAI_API_KEY='your-openai-api-key'
```

`LLM_BASE_URL` and `LLM_MODEL` are optional and default to `https://api.openai.com/v1` and `gpt-4o-mini`.

> [!CAUTION]
> Never commit `.env.local` to version control. It is in `.gitignore` by default.

**Naming (automatic).** With `ZONE_DOMAIN=example.org` and `SUBDOMAIN_PREFIX=cricscore`:

| Environment | URL                        | Resources prefix |
| ----------- | -------------------------- | ---------------- |
| Dev         | `cricscoredev.example.org` | `cricscoredev`   |
| Prod        | `cricscore.example.org`    | `cricscore`      |

- `TF_STATE_BUCKET` must be a globally unique S3 bucket name.
- Optional overrides: `DEV_DOMAIN_NAME`, `DEV_PROJECT_NAME`, `DEV_SUBDOMAIN_PREFIX` (and `PROD_*`).
- Optional Sentry: `cp apps/frontend/.env.example apps/frontend/.env` and set `VITE_SENTRY_DSN`.

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

```bash
./infra/scripts/deploy.sh --env prod --use-local-env --migrate
```

> [!CAUTION]
> The script runs `terraform apply -auto-approve` and `--migrate` changes the database **before** that. There is no dry run. Before Prod, double-check the `.env.local` database URL and see the [Terraform guide](./terraform_guide.md).

---

## Step 5: Sign in and make yourself admin

1. Open your live site and click **SCORER**.
2. Click **Create Account**, enter name, email and password, then confirm the emailed code.
3. AWS Console → **Cognito** → **User pools** → your pool → **Groups** → **Admin** → **Add user to group** → select yourself.
4. Sign out and back in. The **Admin Panel** tab now appears.

---

## Step 6 (optional): GitHub Actions CI/CD

1. Install and log in: `brew install gh && gh auth login`
2. Upload settings from `.env.local` **once**:

```bash
./infra/scripts/setup_github_envs.sh
```

> [!CAUTION]
> Run it once. Running again overwrites your GitHub secrets with whatever is in `.env.local`.

What happens afterwards:

| Event          | Result                                                        |
| -------------- | ------------------------------------------------------------- |
| Open/update PR | Security checks, tests, build, Terraform validate. No deploy. |
| Push to `main` | Deploys **Dev**, then E2E, AI evaluation and security scan.   |
| Push tag `v*`  | Deploys **Prod**, then AI evaluation, E2E and security scan.  |

Prod approval depends on your GitHub `prod` environment protection rules.

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

## Troubleshooting

See [troubleshooting.md](./troubleshooting.md) for solutions to common issues.

For quick checks:

- **Blank page**: wait 5 minutes, then hard-refresh.
- **Login fails**: confirm Terraform output has the Cognito User Pool and Client IDs.
- **No emails**: confirm the SES identity is Verified (and the recipient, if in sandbox).

---

© 2026 CricScore Documentation
