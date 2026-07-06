# 🛠️ Scripts — Local Developer Utilities

Helper scripts for local development, deployment, and validation.

## Scripts

| Script                | Purpose                                                         |
| --------------------- | --------------------------------------------------------------- |
| `deploy_local_dev.sh` | Full local dev deploy (Terraform + S3 sync + CloudFront inval.) |
| `validate_local.sh`   | Pre-push validation suite (lint, tests, tf fmt, security)       |
| `setup.sh`            | Install local security tooling (checkov, gitleaks, trivy, syft) |
| `terraform.sh`        | Thin wrapper around Terraform with variable pre-injection       |

> Note: `deploy_local_dev.sh` lives in the **repo root** for convenience, not in this directory.

## `validate_local.sh` — Pre-Push Checklist

Run this before every `git push` to catch issues locally before CI:

```bash
bash infra/scripts/validate_local.sh
```

It runs the following checks in order:

| Step | Check                         | Tool                   |
| ---- | ----------------------------- | ---------------------- |
| 1    | Frontend lint + tests + build | ESLint + Vitest + Vite |
| 2    | Backend unit tests            | Vitest                 |
| 3    | Terraform format check        | `terraform fmt`        |
| 4    | Terraform validate            | `terraform validate`   |
| 5    | E2E tests (live Dev env)      | Playwright             |
| 6    | IaC security scan             | Checkov                |
| 7    | Secrets scan                  | GitLeaks               |
| 8    | Dependency vuln scan          | Trivy                  |
| 9    | SBOM generation               | Syft                   |

## `setup.sh` — Install Security Tooling

Install all optional security tools on a new machine:

```bash
bash infra/scripts/setup.sh
```

Installs: `checkov`, `gitleaks`, `trivy`, `syft`, `terraform`

## `terraform.sh` — Terraform Wrapper

Runs Terraform with the correct variable file and backend configuration pre-injected. Used internally by `validate_local.sh` and `deploy_local_dev.sh`.

```bash
# Usage (from repo root)
./infra/scripts/terraform.sh plan
./infra/scripts/terraform.sh apply
./infra/scripts/terraform.sh fmt -check -recursive
```
