# 🛡️ Branch Protection & Governance

This document outlines the strict repository governance and branch protection rules enforced on the `main` branch to ensure zero-downtime deployments, maintain code quality, and block security vulnerabilities.

These rules are enforced at the repository level via GitHub.

## 1. Required Status Checks

Before any Pull Request can be merged into `main`, it must successfully pass the following **7 automated CI/CD checks**. These checks cannot be bypassed.

| Check Name                           | Purpose                                                                                                                                      | Workflow Source                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **`Lint & Test`**                    | Executes the `vitest` unit testing suite and `prettier` code formatter for the frontend application. Prevents broken UI code from deploying. | `.github/workflows/frontend.yml`      |
| **`Backend & Terraform Validation`** | Runs `npm test` on lambdas, `trivy` container scanning, `terraform validate`, and Checkov static analysis for AWS IaC.                       | `.github/workflows/backend-infra.yml` |
| **`GitLeaks Scan`**                  | Scans the PR diff for over 150 types of secrets (AWS Keys, Admin PINs, Passwords). Blocks the merge if any hardcoded secret is detected.     | `.github/workflows/secrets.yml`       |
| **`playwright-tests`**               | Executes the End-to-End UI browser testing suite against the staging environment.                                                            | `.github/workflows/e2e.yml`           |
| **`CodeQL`** / **`Analyze Code`**    | Runs GitHub CodeQL Static Application Security Testing (SAST) to detect logical vulnerabilities like XSS or Path Traversal.                  | `.github/workflows/codeql.yml`        |
| **`Syft SBOM Generation`**           | Automatically generates an SPDX Software Bill of Materials (SBOM) for the entire repository to track supply-chain vulnerabilities.           | `.github/workflows/sbom.yml`          |

## 2. Administrator Enforcement

By default, GitHub allows repository administrators to click "Merge" even if the checks fail.
CricScore explicitly disables this bypass:

- **`enforce_admins: true`**: "Do not allow bypassing the above settings". This physically blocks the merge button for all users, including the repository owner, until the pipelines turn green.

## 3. Strict Branch Updating

- **`strict: true`**: "Require branches to be up to date before merging".
  If another developer merges a PR before you, your PR will block merging until you pull the latest `main` branch into your code and re-run all 5 status checks against the newest codebase. This prevents merge conflicts from breaking the live site.

## 4. History Preservation

To preserve an auditable and immutable history of code changes:

- **Allow Force Pushes (`allow_force_pushes`)**: `false`. No one can rewrite the git history of the `main` branch.
- **Allow Deletions (`allow_deletions`)**: `false`. The `main` branch cannot be accidentally or maliciously deleted.

---

© 2026 CricScore Documentation. 🏎️🏁🚀
