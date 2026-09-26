---
name: cricscore-workflow-and-validation
description: Guidelines and scripts for validating CricScore changes locally, running tests, preparing feature branches, and executing release workflows.
---

# CricScore Workflow & Validation Skill

This skill provides step-by-step instructions and references for maintaining code quality, running validations locally, creating PRs, and deploying to DEV and PROD environments.

## 1. Branching & PR Rules

- **Never push directly to `main`**.
- Always create a branch with standard prefix:
  - `fix/description` for bug fixes.
  - `feat/description` for new features.
  - `chore/description` for maintenance or dependencies.

## 2. Local Validation Execution

Before opening a PR or pushing, run:

```bash
./infra/scripts/pre-push-check.sh --skip-e2e
```

This script executes:

1. Backend & Lambda Unit Tests (`vitest`)
2. Security Audits & Secret Scans (`gitleaks`, `trivy`, `checkov`)
3. Terraform Format & Logic Validation (`terraform fmt`, `terraform validate`)

## 3. Pull Request Creation

When local validations pass:

```bash
git push origin <branch-name>
gh pr create --title "<type>: <short summary>" --body "<detailed description>"
```

## 4. Release Automation Lifecycle

- Merging a PR into `main` automatically triggers `CricScore CI/CD` (DEV Deployment).
- Upon success, `Semantic Release` calculates version (e.g. `v4.2.3`), updates `CHANGELOG.md`, and creates a release tag.
- Pushing/Creating a release tag triggers `Deploy PROD`, requiring manual environment approval.
