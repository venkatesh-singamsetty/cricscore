# 🤖 GitHub Actions Architecture & Organization

This document explains the architectural constraints and organizational philosophy for CricScore's automated CI/CD and security pipelines.

## 1. Directory Structure Constraints

GitHub enforces extremely strict directory constraints for its automated services. We must adhere to these rules; any deviation will cause the pipelines to fail silently.

### ❌ What is NOT Allowed:

- **No Subdirectories**: GitHub Actions does not support scanning inside subfolders (e.g., `.github/workflows/cron/dast.yml` will be ignored).
- **Dependabot Isolation**: Dependabot is a native GitHub service, not a GitHub Action. Its configuration **must** sit exactly at `.github/dependabot.yml`. Moving it into the `workflows` directory will break automated dependency updates.

### ✅ Correct Structure:

```text
.github/
├── dependabot.yml           <-- Native Service (Must be here)
└── workflows/               <-- Flat folder structure
    ├── ci-cd.yml
    ├── codeql.yml
    ├── drift.yml
    ├── e2e.yml
    ├── keepalive.yml
    ├── release.yml
    ├── sbom.yml
    └── secrets.yml
```

## 2. Naming Conventions & Logical Grouping

Because we are forced to keep all workflow files completely flat inside the `.github/workflows/` directory, we use strict naming conventions to logically group them by their trigger and purpose:

### Core CI/CD (Triggered on Push to `main`)

These pipelines validate, deploy, and verify the application end-to-end. On every push to `main`, the **Backend & Infrastructure CI/CD** pipeline runs as the authoritative deployment gate:

```
push to main
  │
  ▼
[1] validate          — Backend unit tests + Terraform format/validate + Checkov
  │
  ▼
[2] deploy_dev        — Terraform apply to DEV AWS environment (backend + lambdas)
  │ (parallel)
  └──▶ Frontend deploy_dev — Build React bundle → upload to DEV S3 + CloudFront
  │
  ▼
[3] e2e_dev           — Playwright E2E against DEV site (TEAM A vs TEAM B match)
                        ✅ Match is preserved in DEV DB for manual visual verification
  │
  │  (blocked if e2e_dev fails — PROD will NOT be deployed)
  ▼
[4] deploy_backend_prod   — Requires manual approval in GitHub (environment: prod)
                        Once approved: Terraform apply to PROD AWS environment
  │ (sequential)
  └──▶ deploy_frontend_prod — Build React bundle → upload to PROD S3 + CloudFront
  │
  ▼
[5] e2e_prod          — Playwright E2E against PROD site (TEAM A vs TEAM B match)
                        ✅ Match is preserved in PROD DB for manual visual verification
  │
  └──▶ dast_prod            — OWASP ZAP Baseline Security Scan against PROD
```

**Key gates:**

- **DEV E2E must pass** before PROD deployment is even attempted
- **A SINGLE Manual approval is required** before any PROD deployment runs (GitHub environment protection on `deploy_backend_prod`)
- **E2E matches are preserved** in both DEV and PROD after each run so you can visually verify the scoreboard, live scoring, and UI before signing off

**Workflows:**

- `ci-cd.yml`: Runs the fully unified pipeline above (validate frontend & backend → deploy_dev → dast_dev → e2e_dev → deploy_prod → dast_prod → e2e_prod). Also runs validation-only on PRs.
- `e2e.yml`: Runs Playwright E2E on **pull requests only** against the DEV environment for pre-merge validation.

### Security & Governance (Triggered on Pull Request)

These pipelines perform deep static analysis and compliance checks.

- `codeql.yml`: GitHub Native Static Application Security Testing (SAST).
- `secrets.yml`: GitLeaks detection for hardcoded AWS keys or passwords.
- `sbom.yml`: Generates the SPDX Software Bill of Materials.

### Automated Operations (CRON / Triggers)

These pipelines run asynchronously on schedules or specific deployment events.

- `keepalive.yml`: Scheduled CRON job that pings the Aiven Database to prevent inactivity pauses.
- `drift.yml`: Nightly scheduled Terraform Drift Detection. Runs as a matrix check across both `dev` and `prod` environments, using environment-specific state keys and loading the correct environment secrets/variables to detect manual infrastructure modifications.
- `release.yml`: Triggered automatically on merge to `main` to generate Semantic Versions and changelogs.
