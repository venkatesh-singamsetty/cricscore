## Deployment and Development Workflow

- Never push directly to main branch. Always create a feature/fix branch and open a Pull Request.
- Never push to github repo without running local validations and tests first (`./infra/scripts/pre-push-check.sh`). Never test in GitHub Actions by trial-and-error when it can be verified locally.
- Always deploy from local to dev and test first.
- Always add tests and update documentation for the features added and issues addressed at the time they are made.

## Cloud Cost & Infrastructure Governance

- **Never create paid/expensive AWS resources**: Strictly forbid creating NAT Gateways (~$32/mo), KMS Customer Keys ($1/mo), CloudWatch Dashboards ($3/mo), Secrets Manager ($0.40/mo), or Provisioned Capacity.
- Keep Lambda timeouts bounded (max 10-15s) and CloudWatch log retention capped at 7 days to prevent runaway AWS costs.
- Use SSM Parameter Store (free standard tier) instead of Secrets Manager for non-sensitive configurations.
- Always reuse database connection pools (`pg.Pool`) across Lambda invocations to avoid PostgreSQL connection leaks.
