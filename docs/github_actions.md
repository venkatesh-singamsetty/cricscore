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
    ├── deploy-prod.yml
    ├── drift.yml
    ├── e2e.yml
    ├── keepalive.yml
    ├── pr-summary.yml
    ├── release.yml
    ├── sbom.yml
    └── secrets.yml
```

## 2. Naming Conventions & Logical Grouping

Because we are forced to keep all workflow files completely flat inside the `.github/workflows/` directory, we use strict naming conventions to logically group them by their trigger and purpose:

### Core CI/CD (Triggered on Push to `main`)

These pipelines validate, deploy, and verify the application end-to-end on the DEV environment.

```mermaid
graph TD
    Push[Push to 'main'] --> Validate
    Validate[1. Validate<br>Unit tests, Checkov, TF Lint] --> DeployDev

    DeployDev[2. Deploy DEV<br>Terraform Apply (Backend)] --> E2E
    DeployDev -.->|Parallel| DeployDevFront[2b. Deploy DEV Frontend<br>React Build & S3 Sync]
    DeployDevFront --> E2E

    E2E[3. Playwright E2E<br>Test against live DEV site] --> Release
    Release[4. Semantic Release<br>Auto-generates tag e.g. v2.0.0]

    style Push fill:#2c3e50,stroke:#fff
    style Release fill:#27ae60,stroke:#fff
```

### PROD Deployment (Triggered on Tag Push)

PROD deployments are strictly tied to semantic version tags, allowing immediate rollbacks to previous versions.

```mermaid
graph TD
    TagPush[Push tag 'v*'] --> Approval
    Approval{Manual Approval<br>GitHub Environments} -->|Approved| DeployProd

    DeployProd[1. Deploy PROD<br>Terraform Apply (Backend)] --> E2EProd
    DeployProd -.->|Parallel| DeployProdFront[1b. Deploy PROD Frontend<br>React Build & S3 Sync]
    DeployProdFront --> E2EProd

    E2EProd[2. Playwright E2E<br>Test against live PROD site]
    DeployProdFront --> ZAP
    ZAP[2b. DAST ZAP Scan<br>Security scan against PROD]

    style TagPush fill:#2c3e50,stroke:#fff
    style Approval fill:#f39c12,stroke:#fff
    style ZAP fill:#c0392b,stroke:#fff
```

**Key gates:**

- **DEV E2E must pass** before a semantic version tag is created.
- **A SINGLE Manual approval is required** before any PROD deployment runs (GitHub environment protection on `deploy_prod`).
- **Rollbacks are instant** by manually triggering the `Deploy PROD` workflow and providing an older tag.

**Workflows:**

- `ci-cd.yml`: Validates code, deploys to DEV, runs ZAP & E2E against DEV.
- `deploy-prod.yml`: Deploys a specific tag to PROD, runs ZAP & E2E against PROD.
- `e2e.yml`: A placeholder check for pull requests; actual E2E execution is deferred to the DEV and PROD deployment workflows.

### Security & Governance (Triggered on Pull Request)

These pipelines perform deep static analysis and compliance checks.

- `codeql.yml`: GitHub Native Static Application Security Testing (SAST).
- `secrets.yml`: GitLeaks detection for hardcoded AWS keys or passwords.
- `sbom.yml`: Generates the SPDX Software Bill of Materials.
- `pr-summary.yml`: AI-powered workflow that automatically generates a summary of the PR and tracks status check completions.

### Automated Operations (CRON / Triggers)

These pipelines run asynchronously on schedules or specific deployment events.

- `keepalive.yml`: Scheduled CRON job that pings the Aiven Database to prevent inactivity pauses.
- `drift.yml`: Nightly scheduled Terraform Drift Detection. Runs as a matrix check across both `dev` and `prod` environments, using environment-specific state keys and loading the correct environment secrets/variables to detect manual infrastructure modifications.
- `release.yml`: Triggered automatically on merge to `main` to generate Semantic Versions and changelogs.
