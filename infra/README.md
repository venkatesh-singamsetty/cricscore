# 🏗️ Infrastructure

All infrastructure for CricScore is managed as **Infrastructure as Code (IaC)** using Terraform. No manual click-ops in the AWS Console.

## Structure

```
infra/
├── terraform/      # All AWS resource definitions (Terraform HCL)
├── database/       # PostgreSQL schema definitions and migration scripts
└── scripts/        # Local dev helper scripts (deploy, validate, setup)
```

## Philosophy

- **Everything is code** — if it's not in Terraform, it doesn't exist
- **Environment parity** — `dev` and `prod` share the same Terraform codebase, switched via `TF_VAR_environment`
- **Security first** — IAM least-privilege policies, encryption at rest, no wildcard policies

## Environments

| Environment | Description           | Deployed By                 |
| ----------- | --------------------- | --------------------------- |
| `dev`       | Staging / development | `deploy_local_dev.sh` or CI |
| `prod`      | Live production       | CI/CD after E2E tests pass  |

## Quick Links

- 📖 [Terraform Details](./terraform/README.md)
- 📖 [Database Schema](./database/README.md)
- 📖 [Scripts Reference](./scripts/README.md)
- 📖 [Full Deployment Guide](../docs/deployment.md)
