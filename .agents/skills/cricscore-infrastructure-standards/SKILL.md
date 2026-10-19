---
name: cricscore-infrastructure-standards
description: Use when changing or deploying CricScore Terraform, AWS resources, state/backends, CI/CD infrastructure steps, or environment configuration.
---

# CricScore Infrastructure Standards

## 1. Terraform State, Providers & Validation

- **Environment Isolation**: Keep `dev` (`cricscore/dev/terraform.tfstate`, `environments/dev.tfvars`) and `prod` (`cricscore/prod/terraform.tfstate`, `environments/prod.tfvars`) strictly separated with S3 native state locking (`use_lockfile = true`).
- **AWS Provider Version Pinning (`infra/terraform/providers.tf`)**: Maintain `version = "~> 6.0, != 6.69.0"` on `hashicorp/aws` (`v6.69.0` has a fatal `bufio.Scanner: token too long` bug when updating Lambda code).
- **Mandatory Local Checks**: Always run `./infra/scripts/terraform.sh fmt -check -recursive` and `./infra/scripts/terraform.sh validate` before committing any `.tf` file.

## 2. Local & CI/CD Deployment Workflow

- **Always Deploy & Test `dev` First**:
  - `./infra/scripts/deploy.sh --env dev --use-local-env` loads `.env.local`, installs production Lambda dependencies, builds & pushes the `ml-predict` Docker image to ECR (`docker buildx build --platform linux/amd64 --provenance=false`), runs `terraform apply -auto-approve`, builds the Vite frontend, syncs S3, and invalidates CloudFront.
  - Only deploy to `prod` (`./infra/scripts/deploy.sh --env prod --use-local-env`) after `dev` is verified and when explicitly requested by the user.
  - Note: Local `deploy.sh --env prod` writes production `VITE_*` variables to `apps/frontend/.env` during the build step; never commit `apps/frontend/.env`.
- **Database Migrations Ordering**: In `.github/workflows/ci.yml` (`dev`) and `cd.yml` (`prod`), `infra/database/migrate.sh` runs before `terraform apply`. Locally, pass `--migrate` to `deploy.sh` when schema migrations (`infra/database/migrations/*.sql`) are added.

## 3. Cost & Security Guardrails

- Never add NAT Gateways, KMS CMKs, CloudWatch Dashboards, Secrets Manager secrets, or DynamoDB provisioned capacity.
- Keep `retention_in_days = 7` on all CloudWatch log groups and keep Checkov (`checkov -d infra/terraform/ --quiet`) passing with 0 failed checks.
