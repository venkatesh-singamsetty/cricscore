# 🛠️ CricScore Contributing & Developer Workflow Guide

Welcome to CricScore! This guide outlines the standard development workflow and rules for contributing code to the repository.

To maintain high stability and zero-downtime deployments, direct pushes to the `main` branch are blocked. All changes must follow the **Feature Branch & Pull Request Workflow**.

---

## 🚀 Quick Start: Step-by-Step Workflow

### 1. Sync `main` & Create a Feature Branch

Always start from an up-to-date `main` branch and create a dedicated topic branch:

```bash
# Ensure you are on main and up to date
git checkout main
git pull origin main

# Create a new topic branch (e.g. fix/... or feat/...)
git checkout -b fix/auth-token-refresh
```

---

### 2. Make & Test Your Changes Locally

Before committing or pushing, run the local verification suite. It executes Frontend TypeScript lint, Vitest unit/component tests, `npm audit`, Vite production build, Backend Vitest unit tests, Terraform `fmt -check` and `validate`, Checkov IaC scan, GitLeaks secret detection, Trivy CVE scan, Syft SBOM generation, and (unless `--skip-e2e` is passed) Playwright E2E tests against `dev`:

```bash
# Fast pre-push validation (skips live Playwright E2E)
./infra/scripts/validate_local.sh --skip-e2e

# Full validation suite including live Playwright E2E against dev
./infra/scripts/validate_local.sh

# When apps/ml-engine/ changes, also run the Python ML inference test suite
./apps/ml-engine/venv/bin/pytest apps/ml-engine/test_predict.py
```

---

### 3. Test Full-Stack Changes in the Cloud Sandbox

Because CricScore is a strict Serverless application, we **do not** emulate AWS API Gateway or Lambdas on localhost. To test your frontend and backend changes together before opening or merging a PR:

1. **Pre-flight check & deploy to `dev`:** Push your local changes to the live AWS `dev` environment (`https://cricscoredev.venkateshsingamsetty.com`):
   ```bash
   ./infra/scripts/deploy.sh --env dev --use-local-env --check
   ./infra/scripts/deploy.sh --env dev --use-local-env
   ```
   _(Add `--migrate` if `infra/database/schema.sql` or `infra/database/migrations/*.sql` changed.)_
2. **Run Playwright E2E against `dev` (if UI flows/labels changed):**
   ```bash
   cd apps/e2e && npx playwright test --reporter=list
   ```
3. **Optional — Run frontend dev server locally against `dev` backend:**
   ```bash
   cd apps/frontend
   npm run dev
   ```

---

### 4. Commit Using Conventional Commit Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages and PR titles (Semantic Release uses these to determine version bumps and generate release notes):

```bash
git add .
git commit -m "fix(auth): resolve JWT expiration handling on session refresh"
```

Common prefixes:

- `feat:` — A new feature (triggers a **minor** version release on `main`)
- `fix:` — A bug fix (triggers a **patch** version release on `main`)
- `docs:` — Documentation changes (triggers a **patch** release)
- `chore:` — Maintenance, dependency updates, build tasks (triggers a **patch** release)
- `refactor:` — Code refactoring (triggers a **patch** release)
- `test:` — Adding or updating automated tests
- `ci:` — CI/CD workflow configuration changes

---

### 5. Sync with `origin/main` & Push Your Branch

Always fetch and merge `origin/main` right before pushing so your PR branch is never out-of-date with `main`:

```bash
git fetch origin main && git merge origin/main --no-edit
git push -u origin fix/auth-token-refresh
```

_(Note: Direct pushes to `main` are rejected by GitHub Branch Protection rules.)_

---

### 6. Open a Pull Request & Verify CI / CodeQL

Create a PR against `main` with a clear summary comparing your branch against `origin/main`:

```bash
gh pr create --title "fix(auth): resolve JWT expiration handling on session refresh" \
             --body "Detailed summary of changes, architecture notes, and validation results." \
             --base main
```

When a PR is opened or updated, GitHub Actions automatically runs:

1. **`Security & IaC Validation` (`validate_security`)** — GitLeaks secret detection and Checkov Terraform security scanning
2. **`Frontend Build & Test` (`validate_frontend`)** — Trivy FS scan, TypeScript (`tsc --noEmit`), Vitest unit & component suites, and Vite production build
3. **`Backend & Terraform Validation` (`validate_backend`)** — Vitest Lambda unit tests, Trivy FS scan, and Terraform `fmt -check` & `validate`
4. **`CodeQL` (`Analyze (javascript-typescript)` & `Analyze (python)`)** — Static analysis for security vulnerabilities, unused variables, and code quality

Inspect PR checks and inline CodeQL/review comments after pushing:

```bash
gh pr checks
gh api repos/venkatesh-singamsetty/cricscore/pulls/<PR_NUMBER>/comments
```

---

### 7. Merge into `main` & Automated Release Pipeline

Once all CI checks turn green:

1. **Squash and Merge** the PR into `main` (include the detailed PR summary in the squashed commit body so `@semantic-release` publishes full release notes).
2. Merging to `main` automatically triggers:
   - **`CI` (`deploy_and_test_dev`)**: Runs DB migrations on `dev`, applies Terraform on `dev`, deploys the frontend to S3/CloudFront, runs AI chat evaluation, runs Playwright E2E against `dev`, and executes an OWASP ZAP baseline scan.
   - **`Semantic Release` (`release.yml`)**: Runs after `CI` succeeds on `main`, cuts the next `v*` tag, updates `docs/changelog.md`, and publishes the GitHub Release notes.
   - **`CD` (`cd.yml`)**: Triggered by the published release to deploy, test (Playwright E2E), and ZAP-scan `prod`.

---

## 🛡️ Summary of Rules

| Action                                     | Policy                                                                                                            |
| :----------------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| **Direct pushes to `main`**                | ❌ Blocked by Branch Protection                                                                                   |
| **Pushing without syncing `origin/main`**  | ❌ Prohibited (`git fetch origin main && git merge`)                                                              |
| **Bypassing local validation / CI checks** | ❌ Blocked (`./infra/scripts/validate_local.sh`)                                                                  |
| **Local deployment without `.env.local`**  | ❌ Always pass `--use-local-env` to `deploy.sh`                                                                   |
| **Tests & docs with every code change**    | ✅ Required (`apps/*/test`, `docs/testing.md`, tutorials; `changelog.md` generated by semantic-release on `main`) |

---

© 2026 CricScore Engineering. 🏎️🏁🚀
