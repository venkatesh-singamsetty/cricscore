---
name: cricscore-cost-and-infrastructure-best-practices
description: Best practices for AWS cost management, serverless scaling, database pooling, drift detection, and local pre-testing to avoid redundant CI/CD failures.
---

# CricScore Cost & Infrastructure Best Practices Skill

This skill documents proven patterns to optimize cloud costs, prevent infrastructure drift, manage serverless resources efficiently, and eliminate trial-and-error CI/CD runs.

## 1. Cloud Cost Optimization & Free-Tier Guardrails

- **Forbidden Expensive AWS Resources (DO NOT CREATE)**:
  - **No NAT Gateways** (~$32/mo each): Place Lambdas in public subnets with public IP assignment or use API Gateway endpoints.
  - **No AWS KMS Customer Managed Keys** ($1/mo per key): Use AWS-managed default keys (`aws/ssm`, `aws/s3`).
  - **No CloudWatch Custom Dashboards** ($3/mo each): Rely on CloudWatch metric logs and free console views.
- **Secrets & Sensitive Config Management**:
  - **Zero Hardcoded Secrets**: Never commit API keys, database credentials, or private tokens to code or Terraform variables.
  - **SSM Parameter Store (Free Tier)**: Store environment configurations in SSM Parameter Store (`/cricscore/dev/*` or `/cricscore/prod/*`) as standard parameters (100% Free).
  - **GitHub Secrets**: Inject deployment keys (`AWS_ACCESS_KEY_ID`, `OPENROUTER_API_KEY`, `TF_DATABASE_URL`) safely via GitHub Repository Secrets into Terraform and Lambda `env` blocks.
  - **Automated Scanning**: Run GitLeaks locally (`gitleaks protect -v`) before pushing code.

## 2. Database Connection Pooling (PostgreSQL RDS)

- Always use **pg.Pool** or AWS RDS Proxy for Lambda connections to prevent connection exhaustion (`max_connections exceeded`).
- Ensure `pool.end()` or connection reuse patterns are maintained in serverless handlers outside the function execution body.

## 3. Local Testing First (Zero Trial-and-Error in CI/CD)

- **Never guess or push to GitHub to see if a workflow or test succeeds**.
- Always run local validations prior to opening a PR:
  ```bash
  # Local validation suite (Tests, Linters, Terraform, Security Scans)
  ./infra/scripts/pre-push-check.sh --skip-e2e
  ```
- Test GitHub Action workflows locally when modifying `.github/workflows/` using `act` or dry-running scripts locally.

## 4. Infrastructure Drift & Governance

- Run Terraform formatting and validation checks locally:
  ```bash
  terraform -chdir=infra/terraform fmt -check -recursive
  terraform -chdir=infra/terraform validate
  ```
- Always review `terraform plan` outputs before applying infrastructure changes to DEV or PROD.
