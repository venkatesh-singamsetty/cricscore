# Clone-to-Deploy Checklist

This is the quick checklist for a fresh clone. For the full deployment walkthrough, see [deployment.md](./deployment.md).

> Important: this project is not a pure local-only app. A fresh clone still needs AWS, Aiven PostgreSQL, domain/DNS, SES, Cognito, and an OpenRouter API key.

---

## 1) Clone the repo

```bash
git clone https://github.com/venkatesh-singamsetty/cricscore.git
cd cricscore
```

---

## 2) Install required tools

```bash
./infra/scripts/setup.sh
```

This installs the local tooling needed for Terraform, AWS CLI, Node.js, and related setup tasks.

---

## 3) Configure local environment files

```bash
cp .env.local.example .env.local
cp apps/frontend/.env.example apps/frontend/.env
```

Update `.env.local` with the real values for:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `TF_DATABASE_URL`
- `TF_SES_SOURCE_EMAIL`
- `ADMIN_EMAIL`
- `DOMAIN_NAME`
- `ZONE_DOMAIN`
- `SUBDOMAIN_PREFIX`
- `PROJECT_NAME`
- `LLM_API_KEY`
- `LLM_BASE_URL`

Update `apps/frontend/.env` only if needed for custom values. The deploy script usually injects the runtime API and Cognito variables automatically.

---

## 4) Configure Terraform values

Edit these files:

- `infra/terraform/providers.tf`
- `infra/terraform/environments/dev.tfvars`
- `infra/terraform/environments/prod.tfvars`

Set:

- a globally unique Terraform S3 backend bucket name
- your dev/prod domain names
- the correct hosted zone / parent domain

---

## 5) Bootstrap AWS once

```bash
cd infra/terraform/bootstrap
terraform init
terraform apply
```

This creates the Terraform state bucket, DynamoDB lock table, and hosted zone.

---

## 6) Update DNS nameservers

After bootstrap, copy the AWS Route 53 nameserver values and update your domain registrar.

Wait for DNS propagation before testing the live endpoints.

---

## 7) Verify SES

In AWS SES, verify the domain used by:

- `TF_SES_SOURCE_EMAIL`
- example: `noreply@yourdomain.com`

Without SES verification, the app cannot send match report emails correctly.

---

## 8) Deploy the app

For dev:

```bash
cd ../..
./deploy_local_dev.sh
```

For prod:

```bash
./deploy_local_prod.sh
```

The deploy script automatically:

- runs DB migrations
- provisions Terraform resources
- reads the deployed API and WebSocket URLs
- injects those values into the frontend
- builds the frontend
- uploads it to S3 / CloudFront

---

## 9) Set up GitHub Actions secrets

Run this once so the CI/CD pipeline can deploy from GitHub:

```bash
gh auth login
./infra/scripts/setup_github_envs.sh
```

---

## 10) Finish admin setup

After deployment:

1. open the app
2. create an account
3. go to AWS Console → Cognito → User Pools → Groups
4. add your account to the `Admin` group
5. sign out and sign back in

---

## Required external dependencies

A fresh clone will not work without these:

- AWS account + IAM credentials
- Route 53 / domain
- Aiven PostgreSQL
- Cognito User Pool configured by Terraform
- SES domain verification
- OpenRouter API key

---

## Summary

The project is deployable from a fresh clone, but only after the required external infrastructure exists and the deployment scripts are run in the correct order.
