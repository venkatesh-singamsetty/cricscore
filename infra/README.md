# 🏗️ CricScore Infrastructure (`infra/`)

100% of CricScore's AWS cloud footprint (`dev` + `prod` running for **~$1/month** combined), PostgreSQL schema migrations, and deployment automation scripts live in `infra/`.

---

## 📁 Directory Layout

- **`infra/terraform/` (`./infra/scripts/terraform.sh plan`):**
  - Terraform (`>= 1.10`, `hashicorp/aws ~> 6.0`) HCL definitions provisioning Route 53, ACM, CloudFront, S3, Cognito, API Gateway, 9 Lambdas, SNS, SQS FIFO, DynamoDB, ECR, X-Ray, and AWS Budgets.
- **`infra/database/` (`./infra/database/migrate.sh "$TF_DATABASE_URL" dev`):**
  - PostgreSQL 16 + `pgvector` schema (`schema.sql`) and idempotent migrations (`migrations/*.sql`, `migrate.sh`).
- **`infra/scripts/` (`./infra/scripts/deploy.sh --env dev --use-local-env`):**
  - End-to-end deployment (`deploy.sh`), local shift-left validation gate (`validate_local.sh`), dependency audit (`check_dependencies.sh`), and dashboard generator (`generate_platform_dashboard.sh`).

---

## 🚀 Deployment Commands

```bash
# 1. Pre-flight check (validates AWS CLI, Docker, and .env.local)
./infra/scripts/deploy.sh --env dev --use-local-env --check

# 2. Deploy Development (https://cricscoredev.venkateshsingamsetty.com)
./infra/scripts/deploy.sh --env dev --use-local-env

# 3. Deploy Production (https://cricscore.venkateshsingamsetty.com)
./infra/scripts/deploy.sh --env prod --use-local-env
```

---

## 📖 Related Guides

- **[Step-by-Step Deployment Guide](../docs/deployment.md)** — Complete walkthrough to deploy `dev` and `prod` environments from scratch.
- **[Terraform Infrastructure Tutorial](../docs/terraform_guide.md)** — Module breakdown, remote S3 state locking, and environment isolation patterns.
- **[Cloud Cost Management (`~$1/Month`)](../docs/cost_management.md)** — Service-level cost guardrails and architectural trade-offs keeping AWS spend around `~$1/month`.
- **[Aiven PostgreSQL 16 Setup](../docs/aiven.md)** — Provisioning managed PostgreSQL + `pgvector` and the daily Production E2E keep-alive workflow.
