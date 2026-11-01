---
name: cricscore-cost-governance
description: Use when proposing or reviewing AWS resource, scaling, observability, storage, network, or deployment changes that may affect CricScore operating costs.
---

# CricScore Cost Governance

Refer to `docs/cost_management.md`, `docs/aws_resources_dashboard.md`, and `infra/terraform/` before adding or modifying any AWS resource.

## 1. Strictly Forbidden Paid Resources

Never provision any of the following in Terraform or via AWS CLI:

- **NAT Gateways / VPC Endpoints** (~$32+/month) — Keep Lambdas outside VPC or use public serverless endpoints with TLS/IAM/JWT auth.
- **KMS Customer-Managed Keys (CMKs)** ($1/key/month + API charges) — Use default AWS-managed encryption (`AES256` / AWS-owned keys) for S3, DynamoDB, SQS, SNS, and ECR.
- **CloudWatch Dashboards & Custom Metrics** ($3/dashboard/month + $0.30/metric) — Rely on the auto-generated `docs/aws_resources_dashboard.md` and standard free CloudWatch metrics.
- **AWS Secrets Manager** ($0.40/secret/month) — Use Terraform variables from GitHub Environment secrets or **SSM Parameter Store (Standard Tier, no charge)**.
- **DynamoDB Provisioned Capacity** — Always use `billing_mode = "PAY_PER_REQUEST"` on `websocket_connections`.

## 1b. Cost Baseline

| Item               | Rule                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Total AWS cost     | ~$1/month for Dev + Prod combined. Never describe it as $0 or "zero-cost"                                                                        |
| ECR (`ml-predict`) | Private ECR (required for Lambda). One image per env (`countNumber = 1`), `xgboost-cpu` base, ~309 MB. Never push `:latest` or keep old versions |
| Model history      | Stored in S3 (`models/<version>/`), not ECR                                                                                                      |

## 2. Compute, Storage & Log Retention Guardrails

- **Lambda Timeouts & Memory (`infra/terraform/lambda.tf`)**:
  - Real-time/API Lambdas (`match-api`, `score-update`, `storage-worker`, `broadcaster`, `onconnect`, `ondisconnect`): Keep timeouts bounded at **5–15 seconds** and memory at `128MB–256MB`.
  - AI/ML Lambdas (`chat-api`, `ml-predict`): Keep timeouts bounded at `30s` and memory capped at `1024MB`.
- **CloudWatch Log Retention**: Every `aws_cloudwatch_log_group` must set `retention_in_days = 7` so log storage costs stay minimal.
- **Database Connection Pooling**: Always reuse a module-scoped `pg.Pool` across warm Lambda invocations so Aiven PostgreSQL free/startup connection limits are never exhausted.
- **AWS Budgets (`infra/terraform/cost_budget.tf`)**: Maintain the configured monthly cost budget ($5.00 threshold alert) as an early warning system.

## 3. Resource Inventory Tracking

- `.husky/pre-commit` runs `infra/scripts/generate_platform_dashboard.sh` and stages `docs/platform_dashboard.md` and `docs/aws_resources_dashboard.md`. Never hand-edit them; fix the generator (`infra/scripts/generate_platform_dashboard.py`) instead. Verify the generated inventory shows no unexpected paid resources.
