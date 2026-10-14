---
name: cricscore-security-standards
description: Use when changing authentication, authorization, database/API handling, secrets, dependencies, infrastructure exposure, or CricScore security scans.
---

# CricScore Security Standards

## Secrets and trust boundaries

- Never commit, print, or expose API keys, database URLs, access tokens, or populated local environment files. Use the existing `.env.local` and GitHub Environment secret flow; preserve `.gitignore` protections.
- Terraform variables and Lambda environment values may be represented in Terraform state and deployment logs. Treat remote state, plan files, and CI output as sensitive; do not assume a `sensitive` variable is absent from state.
- Keep secrets server-side. Do not pass credentials to the frontend, model prompts, MCP tool results, or error responses.
- Verify authorization in trusted backend code and derive identity and roles from verified claims. Never trust client-supplied role flags, match IDs, or model-generated tool arguments without validation.

## Secure implementation and checks

- Parameterize SQL values; constrain query permissions, execution time, and returned data. Validate request bodies, file uploads, and external API responses.
- Preserve HTTPS, least-privilege IAM, environment separation, and safe error handling. Do not weaken controls to resolve a scanner finding without understanding and documenting the risk.
- Run `./infra/scripts/validate_local.sh --skip-e2e` when appropriate. It runs GitLeaks, Checkov, and Trivy only when those tools are installed; report any skipped scans. CI scanner definitions are in `.github/workflows/ci.yml`.
