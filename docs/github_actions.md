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
    ├── backend-infra.yml
    ├── codeql.yml
    ├── dast.yml
    ├── e2e.yml
    ├── frontend.yml
    ├── keepalive.yml
    ├── release.yml
    ├── sbom.yml
    └── secrets.yml
```

## 2. Naming Conventions & Logical Grouping

Because we are forced to keep all workflow files completely flat inside the `.github/workflows/` directory, we use strict naming conventions to logically group them by their trigger and purpose:

### Core CI/CD (Triggered on Push/Pull Request)

These pipelines validate that the application builds, tests pass, and infrastructure is secure before deployment.

- `frontend.yml`: Validates React UI components (Vitest, ESLint).
- `backend-infra.yml`: Validates Serverless Lambdas and Terraform configurations.
- `e2e.yml`: Executes End-to-End browser tests via Playwright.

### Security & Governance (Triggered on Pull Request)

These pipelines perform deep static analysis and compliance checks.

- `codeql.yml`: GitHub Native Static Application Security Testing (SAST).
- `secrets.yml`: GitLeaks detection for hardcoded AWS keys or passwords.
- `sbom.yml`: Generates the SPDX Software Bill of Materials.

### Automated Operations (CRON / Triggers)

These pipelines run asynchronously on schedules or specific deployment events.

- `keepalive.yml`: Scheduled CRON job that pings the Aiven Database to prevent inactivity pauses.
- `dast.yml`: Nightly scheduled Dynamic Application Security Testing (OWASP ZAP) against the live API.
- `release.yml`: Triggered automatically on merge to `main` to generate Semantic Versions and changelogs.
