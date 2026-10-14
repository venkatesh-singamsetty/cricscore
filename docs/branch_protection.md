# 🛡️ Branch Protection & Governance

This document describes the repository's branch-protection guidance. Verify which rules and required status checks are currently enabled in the GitHub repository settings; those settings are not defined by the workflow files.

The `CI` and `CodeQL Analysis` workflows run validation on pull requests targeting `main`.

## 1. Pull Request Workflow Checks

The workflows produce the following checks on pull requests. Whether GitHub requires a check before merging depends on the repository's branch-protection settings.

| Workflow check                          | What it runs                                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| **`Infrastructure & Secrets Security`** | GitLeaks and Checkov                                                                |
| **`Lint & Test`**                       | Frontend Trivy scan, type-check/lint, unit tests, and production build              |
| **`Backend & Terraform Validation`**    | Backend tests, backend Trivy scan, Terraform format check, and Terraform validation |
| **`Analyze Code`**                      | JavaScript/TypeScript CodeQL analysis                                               |

The deployment and Playwright jobs in `ci.yml` run on `main` (or manual dispatch), not on pull requests. The SBOM workflow runs on pushes to `main`, weekly, and by manual dispatch.

## 2. Recommended Branch Protection

Consider requiring the appropriate pull-request checks and enabling administrator enforcement. Confirm the actual values in GitHub settings before relying on them.

## 3. Recommended Branch Updating

Requiring branches to be up to date before merging can ensure changes are validated against the latest `main`. Confirm whether this setting is enabled in GitHub.

## 4. History Protection

Consider disabling force pushes and branch deletion for `main`; verify these settings in GitHub.

---

© 2026 CricScore Documentation. 🏎️🏁🚀
