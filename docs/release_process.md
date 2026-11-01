# 🚀 Automated Release & Versioning Process

CricScore automates semantic versioning (`v[Major].[Minor].[Patch]`), changelog generation (`docs/changelog.md`), GitHub Releases, and production deployments using **Semantic Release** (`.releaserc.json`) and **Conventional Commits**.

```mermaid
flowchart LR
    A["1. Feature Branch\nConventional Commits"] --> B["2. Pull Request\n4 Parallel CI Gates"]
    B --> C["3. Merge to main\nci.yml Deploys DEV + E2E"]
    C --> D["4. workflow_run: CI Success\nrelease.yml Runs Semantic Release"]
    D --> E["5. Git Tag v* + docs/changelog.md\n+ Enriched GitHub Release"]
    E --> F["6. cd.yml Deploys PROD\n+ E2E & OWASP ZAP"]
```

---

## 1. The Conventional Commit Standard

Every commit message and squash-merged PR title must use a Conventional Commit prefix. `.releaserc.json` maps prefixes to semantic version bumps and changelog sections as follows:

| Commit Prefix                  | Purpose                                                | Version Bump                      | Changelog Section             | Example                            |
| :----------------------------- | :----------------------------------------------------- | :-------------------------------- | :---------------------------- | :--------------------------------- |
| `feat!:` or `BREAKING CHANGE:` | Incompatible breaking change                           | **MAJOR** (`v4.0.0` ➔ `v5.0.0`)   | 🚀 Features                   | `feat!: redesign database schema`  |
| `feat:`                        | New user-facing or platform feature                    | **MINOR** (`v4.19.0` ➔ `v4.20.0`) | 🚀 Features                   | `feat: add dark mode to dashboard` |
| `fix:`                         | Bug fix                                                | **PATCH** (`v4.19.2` ➔ `v4.19.3`) | 🐛 Bug Fixes                  | `fix: resolve CORS issue on API`   |
| `perf:`                        | Performance optimization                               | **PATCH**                         | ⚡ Performance Improvements   | `perf: optimize database query`    |
| `docs:`                        | Documentation update (configured in `.releaserc.json`) | **PATCH**                         | 📚 Documentation              | `docs: update cost management`     |
| `refactor:`                    | Code refactoring (configured in `.releaserc.json`)     | **PATCH**                         | ♻️ Code Refactoring           | `refactor: extract scoring logic`  |
| `chore:`                       | Maintenance / dependency update (`.releaserc.json`)    | **PATCH**                         | 🧰 Maintenance & Dependencies | `chore: update dependencies`       |
| `build:`                       | Build system update                                    | **None** (Skips Release)          | —                             | `build: update semantic release`   |
| `ci:`                          | CI/CD workflow change                                  | **None** (Skips Release)          | ⚙️ CI/CD Pipelines            | `ci: fix github action syntax`     |
| `test:`                        | Test-only addition or update                           | **None** (Skips Release)          | 🧪 Tests                      | `test: add match-api unit tests`   |
| `style:`                       | Formatting / whitespace change                         | **None** (Skips Release)          | 💅 Styles                     | `style: format with prettier`      |

> [!NOTE]
> If a push to `main` contains only `build:`, `ci:`, `test:`, or `style:` commits, Semantic Release exits cleanly without cutting a new tag or triggering `cd.yml`.

---

## 2. End-to-End Release Lifecycle

| Stage                     | Trigger / Actor                           | Workflow / Script                                           | What Happens                                                                                                                                                                                                                  |
| :------------------------ | :---------------------------------------- | :---------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Local Commit**       | Developer (`git commit`)                  | `.husky/pre-commit`                                         | • Runs GitLeaks secrets scan and formatting checks locally<br/>• No version tags are created on feature branches                                                                                                              |
| **2. Pull Request**       | Open / update PR to `main`                | `.github/workflows/ci.yml`                                  | • Runs `validate_security`, `validate_frontend`, `validate_backend`, and `validate_python` (`376` unit tests)<br/>• Stops without deploying to AWS                                                                            |
| **3. Merge & DEV Deploy** | Squash-merge PR to `main`                 | `.github/workflows/ci.yml`                                  | • Runs `deploy_and_test_dev`: DB migrations (`dev`), `terraform init -upgrade` & `apply`, and 7-day Lambda log retention<br/>• Deploys SPA to S3/CloudFront<br/>• Runs AI evals, 14 Playwright E2E tests, and OWASP ZAP scan  |
| **4. Version Calc**       | `workflow_run` (`CI` succeeded on `main`) | `.github/workflows/release.yml`                             | • Checks out `main` with `secrets.GH_PAT`<br/>• Resets to the exact tested SHA (`github.event.workflow_run.head_sha`)<br/>• Executes `npx semantic-release`                                                                   |
| **5. Tag & Enrich**       | `@semantic-release/*` + enrichment script | `.releaserc.json` & `infra/scripts/enrich_release_notes.sh` | • Updates `docs/changelog.md` and commits `chore(release): vX.Y.Z [skip ci]` via `GH_PAT`<br/>• Publishes Git tag `vX.Y.Z` and GitHub Release<br/>• Runs `enrich_release_notes.sh` to append the linked PR's `## 🎯 Overview` |
| **6. PROD Deploy**        | GitHub Release published / `v*` tag       | `.github/workflows/cd.yml`                                  | • Runs `deploy_and_test_prod`: DB migrations (`prod`), `terraform init -upgrade` & `apply`, and 7-day Lambda log retention<br/>• Deploys SPA to S3/CloudFront<br/>• Runs AI evals, Playwright E2E, and OWASP ZAP scan         |

---

## 3. Useful Release & Verification Commands

```bash
# 1. View the latest published GitHub Release and its enriched notes
gh release view

# 2. List recent semantic version tags
git tag --sort=-v:refname | head -n 10

# 3. Manually re-run the release notes enrichment script for the latest release
./infra/scripts/enrich_release_notes.sh

# 4. Manually trigger a production deployment for a specific version tag
gh workflow run cd.yml -f tag=v4.19.2
```

---

## 4. Configuration Reference

| File / Secret                 | Role in Release Pipeline                                                                                                                                                                       |
| :---------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`.releaserc.json`**         | • Configures `@semantic-release/commit-analyzer` and `@semantic-release/release-notes-generator`<br/>• Updates `docs/changelog.md` via `@semantic-release/changelog`<br/>• Commits `[skip ci]` |
| **`enrich_release_notes.sh`** | • Ensures the GitHub Release title is strictly the tag name (e.g. `v4.19.2`)<br/>• Appends the `## 🎯 Overview` summary from referenced PRs (`#123`)                                           |
| **`secrets.GH_PAT`**          | • Repository administrator Personal Access Token used by `release.yml`<br/>• Pushes the `chore(release): ... [skip ci]` commit directly to protected `main`                                    |
| **`package.json` `version`**  | • Ignored (`private` monorepo)<br/>• Versioning is governed strictly by Git tags and GitHub Releases                                                                                           |
