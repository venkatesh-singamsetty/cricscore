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

Before committing, you can run the full local verification script which perfectly mirrors the CI/CD pipeline. This script includes Linting, Unit Tests, `npm audit`, Terraform formatting, DynamoDB lock checks, Trivy security scans, and Playwright E2E tests:

```bash
# Run the full validation suite (takes 1-3 minutes)
./infra/scripts/validate_local.sh

# Run the validation suite but skip the heavy Playwright tests
./infra/scripts/validate_local.sh --skip-e2e
```

---

### 3. Commit Using Conventional Commit Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages:

```bash
git add .
git commit -m "fix(auth): resolve JWT expiration handling on session refresh"
```

Common prefixes:

- `feat:` — A new feature
- `fix:` — A bug fix
- `docs:` — Documentation changes only
- `chore:` — Maintenance, dependency updates, build tasks
- `ci:` — CI/CD workflow configuration changes
- `refactor:` — Code changes that neither fix bugs nor add features
- `test:` — Adding missing tests or correcting existing tests

---

### 4. Push Your Branch to GitHub

Push your topic branch to the remote repository:

```bash
git push -u origin fix/auth-token-refresh
```

> **Note:** The repository uses a Git `pre-push` hook. Every time you push, it will automatically run `./infra/scripts/validate_local.sh --skip-e2e`. If any unit tests, formatting checks, security audits, or Terraform state locks fail, your push will be blocked!

_(Note: Direct pushes to `main` will be rejected by GitHub Branch Protection rules)_

---

### 5. Open a Pull Request (PR)

Create a PR against the `main` branch using the GitHub UI or the GitHub CLI:

```bash
gh pr create --title "fix(auth): resolve JWT expiration handling on session refresh" \
             --body "Fixes issue where JWT refresh triggers premature logout."
```

---

### 6. Automated CI/CD Verification

When a PR is opened, GitHub Actions automatically executes the required status checks:

1. **`GitLeaks Scan`** — Scans diff for secrets/keys
2. **`playwright-tests`** — Runs End-to-End browser UI tests
3. **`Analyze Code (javascript-typescript)`** — SAST security scanning for JS/TS
4. **`Lint & Test`** — Vitest unit tests and code formatting checks
5. **`Backend & Terraform Validation`** — Lambda unit tests & Terraform IaC checks
6. **`CodeQL`** — SAST status check wrapper
7. **`Syft SBOM Generation`** — SPDX Software Bill of Materials check
8. **`AI Chat Evaluation`** — AI dataset schema validation & chat handler unit tests

All status checks must pass before the PR can be merged.

---

### 7. Syncing with `main` (If Conflicts Occur)

If changes were merged to `main` while working on your branch, update your branch:

```bash
git fetch origin
git rebase origin/main

# If conflicts occur, resolve them, then run:
git add .
git rebase --continue

# Push updated branch (force-with-lease for rebased branch)
git push --force-with-lease
```

---

### 8. Merge into `main`

Once all CI checks turn green:

1. Merge the PR on GitHub (using **Squash and Merge** or **Rebase and Merge**).
2. Clean up local and remote feature branches:
   ```bash
   git checkout main
   git pull origin main
   git branch -d fix/auth-token-refresh
   ```

---

## 🛡️ Summary of Rules

| Action                         | Policy                              |
| :----------------------------- | :---------------------------------- |
| **Direct pushes to `main`**    | ❌ Blocked by Branch Protection     |
| **Bypassing failing CI tests** | ❌ Blocked (`enforce_admins: true`) |
| **Force pushing to `main`**    | ❌ Disabled                         |
| **PR Status Checks Required**  | ✅ Must pass all 8 CI checks        |

---

© 2026 CricScore Engineering. 🏎️🏁🚀
