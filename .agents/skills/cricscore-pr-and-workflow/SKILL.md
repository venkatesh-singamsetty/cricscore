---
name: cricscore-pr-and-workflow
description: Use when preparing a CricScore branch or pull request, selecting local validation, changing CI/release workflows, or updating developer commands.
---

# CricScore PR and Workflow Standards

## 1. Branch & Pre-Push Checklist (Mandatory)

1. **Always pull `main` & create a fresh branch for every new feature or bug fix**:
   - Before starting any new feature or bug fix, run:
     `git checkout main && git pull origin main && git checkout -b <feat|fix>/<descriptive-name>`
   - Never push directly to `main`, never reuse an already-merged PR branch, and do not force-push or rewrite shared history without explicit user authorization.
2. **Always sync with `origin/main` before pushing**:
   - Run `git fetch origin main`
   - Check if `origin/main` has new commits (`git log HEAD..origin/main --oneline`)
   - Merge `origin/main` into your branch (`git merge origin/main --no-edit`) so the PR branch is never out-of-date with `main`.
3. **Verify Git Hygiene**:
   - Run `git status -s` and `git diff --cached --stat`.
   - Ensure no `.env`, `.env.local`, `__pycache__/`, `*.pyc`, `venv/`, or temporary test screenshots (`*.png` in `apps/e2e/`) are tracked or staged.
4. **Run Full Local Validation Before Pushing**:
   - Run `./infra/scripts/validate_local.sh --skip-e2e` for fast pre-push verification (Frontend lint, Vitest, `npm audit`, Vite build, Backend Vitest, Backend `npm audit`, Terraform `fmt` & `validate`, Checkov, GitLeaks, Trivy, Syft SBOM).
   - Validation automatically leaves a cached receipt in `.git/.local_validation_receipt` keyed to current commit and tree status. Git's `.husky/pre-push` checks this receipt and skips duplicate re-runs instantly (<0.1s) when pushing, avoiding redundant test runs.
   - When UI flows, selectors, or APIs change, deploy to `dev` first and run Playwright E2E against `dev` (`cd apps/e2e && npx playwright test --reporter=list`) so `CI` on `main` never fails or hangs.
   - When `apps/ml-engine/` changes, run `./apps/ml-engine/venv/bin/pytest apps/ml-engine/test_predict.py`.

## 2. Pull Request Creation & Post-PR Verification

- **Compare against `origin/main`**: Use `git diff origin/main --stat` and `git log origin/main..HEAD` to write an accurate PR description covering:
  - Summary of changes & user-visible behavior
  - Architectural & backend/ML/UI details
  - Validation & test suites executed
- **Inspect Checks & CodeQL Alerts After Pushing**:
  - Check status with `gh pr checks <PR_NUMBER>`.
  - Fetch inline review/CodeQL comments with `gh api repos/venkatesh-singamsetty/cricscore/pulls/<PR_NUMBER>/comments`.
  - Immediately fix any CodeQL warnings (e.g., unused variables/imports) or failing checks.

## 3. CI, Semantic Release & CD Pipeline Architecture

- **Pull Requests (`.github/workflows/ci.yml` + `codeql.yml`)**: Run `validate_security` (GitLeaks, Checkov), `validate_frontend` (Trivy, `tsc --noEmit`, Vitest, `npm run build`), `validate_backend` (Vitest, Trivy, Terraform `fmt` & `validate`), and CodeQL analysis.
- **Merge to `main` (`.github/workflows/ci.yml` -> `release.yml` -> `cd.yml`)**:
  1. `CI` runs all validation jobs and then `deploy_and_test_dev` (Postgres migrations on `dev`, Terraform apply on `dev`, S3/CloudFront deploy, AI chat eval, Playwright E2E against `dev`, and OWASP ZAP baseline scan).
  2. When `CI` on `main` completes with `success`, `Semantic Release` (`.github/workflows/release.yml`) runs `npx semantic-release`, scanning **all conventional commits since the last `v*` Git tag** to cut the next version tag, update `docs/changelog.md`, and publish the GitHub Release notes.
  3. Publishing the release triggers `CD` (`.github/workflows/cd.yml`) to deploy, test (Playwright E2E), and ZAP-scan `prod`.
- **Documentation Sync**: Whenever developer commands, package scripts, or workflows change, update `CHEATSHEET.md`, `docs/deployment.md`, and `docs/testing.md`.
