---
name: cricscore-infrastructure-standards
description: Use when changing or deploying CricScore Terraform, AWS resources, state/backends, CI/CD infrastructure steps, or environment configuration.
---

# CricScore Infrastructure & Deployment Standards

## 1. Exact Local Deployment Commands (`.env.local` Mandatory)

**NEVER** run `deploy.sh` without `--use-local-env`, and **NEVER** run raw `terraform apply` directly without `deploy.sh` or `./infra/scripts/terraform.sh` (which sources `.env.local` and maps `TF_VAR_*` variables).

1. **Pre-Flight Check (Verify AWS credentials, Docker daemon, and `.env.local` first)**:
   ```bash
   ./infra/scripts/deploy.sh --env dev --use-local-env --check
   ```
2. **Deploy to `dev` (Always deploy & verify `dev` before `prod`)**:
   ```bash
   ./infra/scripts/deploy.sh --env dev --use-local-env
   ```
   - Add `--migrate` (`./infra/scripts/deploy.sh --env dev --use-local-env --migrate`) whenever `infra/database/schema.sql` or `infra/database/migrations/*.sql` changed.
3. **Deploy to `prod` (Only when explicitly requested by the user after `dev` is verified)**:
   ```bash
   ./infra/scripts/deploy.sh --env prod --use-local-env
   ```

> **Note on Sandbox**: `deploy.sh` requires network access (AWS STS/S3/CloudFront/ECR) and the local Docker daemon (`docker info` / `docker buildx`), which are blocked in the terminal sandbox (`BypassSandbox: false`). If the sandbox blocks `deploy.sh`, re-run the exact single command with `BypassSandbox: true`.

---

## 2. Critical Deployment Gotchas & How to Avoid Them

1. **Environment State & `apps/frontend/.env` Contamination After `prod` Deploys**:
   - `deploy.sh --env <env> --use-local-env` reconfigures `infra/terraform/.terraform` to `cricscore/<env>/terraform.tfstate` AND rewrites `apps/frontend/.env` with `<env>`'s `VITE_API_URL`, `VITE_WS_URL`, `VITE_APP_TITLE`, and `VITE_COGNITO_*` values.
   - **Never** run a fast-path `npm run build` + `aws s3 sync` assuming `apps/frontend/.env` points to `dev` if `prod` was deployed last! Always inspect `apps/frontend/.env` (`grep VITE_API_URL apps/frontend/.env`) or run the full `./infra/scripts/deploy.sh --env dev|prod --use-local-env` script so outputs and S3 buckets match the target environment:
     - **Dev S3 / CloudFront / API**: `cricscoredev.venkateshsingamsetty.com` (`s3://cricscoredev-app-7e93ca64fca840e1639f6fbd71`, CloudFront `E2ZGF7CGRTEU5G`)
     - **Prod S3 / CloudFront / API**: `cricscore.venkateshsingamsetty.com` (`s3://cricscore-app-7e93ca64fca840e1639f6fbd71`, CloudFront `E3FVVHMKMZ5G5O`)
   - Never commit `apps/frontend/.env` to Git.
2. **ML Predict Container (`ml-predict`) ECR Push & Lambda Refresh (`infra/terraform/lambda.tf`)**:
   - `null_resource.docker_build_push` triggers whenever any file in `apps/ml-engine/*` changes (`dir_sha1`), logs into ECR (`${var.project_name}-ml-predict`), builds `linux/amd64` with `--provenance=false`, pushes `:${var.ml_model_version}` (single tag, no `:latest`; ECR retains one image), and runs `aws lambda update-function-code` + `aws lambda wait function-updated` for `${var.project_name}-ml-predict` (`cricscoredev-ml-predict` or `cricscore-ml-predict`).
   - Always ensure Docker Desktop is running (`docker info`) before running `deploy.sh`!
3. **AWS Provider Version Pin (`infra/terraform/providers.tf`)**:
   - Because `deploy.sh` passes `-upgrade` to `terraform init`, `infra/terraform/providers.tf` **MUST** keep `version = "~> 6.0, != 6.69.0"` on `hashicorp/aws`. Version `6.69.0` has a fatal `bufio.Scanner: token too long` bug when updating Node.js Lambda zip archives.
4. **Terraform Formatting & Validation**:
   - Before committing any `.tf` file, always run `./infra/scripts/terraform.sh fmt -check -recursive` and `./infra/scripts/terraform.sh validate` (which automatically sources `.env.local` and exports `TF_VAR_*`).

---

## 3. Cloud Cost & Security Guardrails

- Never add NAT Gateways, KMS Customer-Managed Keys, CloudWatch Dashboards, AWS Secrets Manager secrets, or DynamoDB provisioned capacity.
- Keep `retention_in_days = 7` on all CloudWatch log groups and keep Checkov (`checkov -d infra/terraform/ --quiet`) passing with 0 failed checks.
