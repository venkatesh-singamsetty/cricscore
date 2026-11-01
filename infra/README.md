# 🏗️ CricScore Infrastructure (`infra/`)

100% of CricScore's AWS cloud footprint (`dev` + `prod` running for **~$1/month** combined), PostgreSQL schema migrations, and deployment automation scripts live in `infra/`.

---

## 📁 Directory Layout

| Directory          | Contents                                                                                                                                                                                       | Primary Entrypoint                                    |
| :----------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------- |
| `infra/terraform/` | Terraform (`>= 1.10`, `hashicorp/aws ~> 6.0`) HCL definitions for Route 53, ACM, CloudFront, S3, Cognito, API Gateway, 9 Lambdas, SNS, SQS FIFO, DynamoDB, ECR, X-Ray, CloudWatch, and Budgets | `./infra/scripts/terraform.sh plan`                   |
| `infra/database/`  | PostgreSQL 16 + `pgvector` schema (`schema.sql`) and idempotent migrations (`migrations/*.sql`, `migrate.sh`)                                                                                  | `./infra/database/migrate.sh "$TF_DATABASE_URL" dev`  |
| `infra/scripts/`   | End-to-end deployment (`deploy.sh`), local shift-left gate (`validate_local.sh`), dependency audit (`check_dependencies.sh`), and dashboard generator (`generate_platform_dashboard.sh`)       | `./infra/scripts/deploy.sh --env dev --use-local-env` |

---

## 🚀 Deployment Commands

| Environment             | Domain                                          | Deploy Command                                                |
| :---------------------- | :---------------------------------------------- | :------------------------------------------------------------ |
| **Development (`dev`)** | `https://cricscoredev.venkateshsingamsetty.com` | `./infra/scripts/deploy.sh --env dev --use-local-env`         |
| **Production (`prod`)** | `https://cricscore.venkateshsingamsetty.com`    | `./infra/scripts/deploy.sh --env prod --use-local-env`        |
| **Pre-Flight Check**    | Validates AWS CLI, Docker, and `.env.local`     | `./infra/scripts/deploy.sh --env dev --use-local-env --check` |

---

## 📖 Related Guides

- **[Step-by-Step Deployment Guide](../docs/deployment.md)**
- **[Terraform Infrastructure Tutorial](../docs/terraform_guide.md)**
- **[Cloud Cost Management (`~$1/Month`)](../docs/cost_management.md)**
- **[Aiven PostgreSQL 16 Setup](../docs/aiven.md)**
