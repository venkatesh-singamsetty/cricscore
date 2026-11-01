# 🛠️ CricScore Contributing & Developer Workflow Tutorial

Direct pushes to `main` are blocked by GitHub Branch Protection. Every code or documentation change follows a 7-step **Feature Branch → Local Validation → Dev Cloud Verification → Pull Request → Automated Release** workflow.

---

## 🔄 End-to-End Contribution Pipeline

```mermaid
flowchart LR
    Step1["1. Branch from main"] --> Step2["2. Run validate_local.sh"]
    Step2 --> Step3["3. Deploy & Test on Dev"]
    Step3 --> Step4["4. Conventional Commit"]
    Step4 --> Step5["5. Sync main & Push"]
    Step5 --> Step6["6. Open PR & Pass CI Checks"]
    Step6 --> Step7["7. Squash Merge -> Prod CD"]
```

---

## 📋 Step-by-Step Developer Tutorial

| Step  | Goal                                 | Command / Action                                                                      |
| :---: | :----------------------------------- | :------------------------------------------------------------------------------------ |
| **1** | **Sync `main` & create branch**      | `git checkout main && git pull origin main && git checkout -b feat/my-change`         |
| **2** | **Run local verification gate**      | `./infra/scripts/validate_local.sh --skip-e2e`                                        |
| **3** | **Deploy & verify on `dev` cloud**   | `./infra/scripts/deploy.sh --env dev --use-local-env`                                 |
| **4** | **Commit with Conventional Commits** | `git add . && git commit -m "feat(scope): concise summary"`                           |
| **5** | **Sync `origin/main` & push**        | `git fetch origin main && git merge origin/main --no-edit && git push -u origin HEAD` |
| **6** | **Open PR & verify status checks**   | `gh pr create --base main` and `gh pr checks`                                         |
| **7** | **Squash & merge into `main`**       | `gh pr merge --auto --squash --delete-branch`                                         |

---

### Step 1: Sync `main` & Create a Feature Branch

```bash
git checkout main
git pull origin main
git checkout -b feat/your-feature-name
```

### Step 2: Run the Local Validation Gate (`376` Unit Tests + 6 Security Scanners)

`./infra/scripts/validate_local.sh` runs the exact same checks enforced by GitHub Actions CI:

| Check                     | Tool / Runner                                   | What It Verifies                                                       |
| :------------------------ | :---------------------------------------------- | :--------------------------------------------------------------------- |
| **Frontend Lint & Build** | ESLint + `tsc -b` + Vite                        | Zero TypeScript/ESLint errors and clean production bundle              |
| **Frontend Unit Tests**   | Vitest (`apps/frontend`)                        | **151** component, hook, DLS, and state sync tests                     |
| **Backend Unit Tests**    | Vitest (`apps/backend`)                         | **121** Lambda handler, SQL guard, MCP, and deterministic POTM tests   |
| **Python AI & ML Tests**  | Pytest (`apps/ai-service`, `apps/ml-engine`)    | **75** LangGraph/MCP agent tests + **29** hybrid win-probability tests |
| **IaC & Secret Scans**    | Terraform `fmt`/`validate` + Checkov + GitLeaks | Valid HCL formatting, AWS security policies, and zero leaked secrets   |
| **CVE & Supply Chain**    | `npm audit` + Trivy FS + Syft SPDX SBOM         | Zero high/critical fixable CVEs and updated dependency manifest        |

```bash
# Fast pre-push validation (~25s, skips live Playwright E2E)
./infra/scripts/validate_local.sh --skip-e2e

# Full validation including live Playwright E2E against Dev
./infra/scripts/validate_local.sh
```

### Step 3: Deploy & Test in the `dev` Cloud Sandbox

Because CricScore is 100% serverless, always verify full-stack changes against the live **`dev`** environment (`https://cricscoredev.venkateshsingamsetty.com`) before merging:

```bash
# Pre-flight check + deploy to dev (add --migrate if SQL migrations changed)
./infra/scripts/deploy.sh --env dev --use-local-env --check
./infra/scripts/deploy.sh --env dev --use-local-env

# Run Playwright E2E against dev when UI flows change
cd apps/e2e && npx playwright test --reporter=list
```

### Step 4: Commit Using Conventional Commits

Semantic Release parses commit prefixes on `main` to calculate the next `v*` version tag and update `docs/changelog.md`:

| Prefix                                             | Purpose                                       | Version Bump on `main` |
| :------------------------------------------------- | :-------------------------------------------- | :--------------------: |
| `feat:`                                            | New user-facing or architectural feature      |  **Minor** (`v1.X.0`)  |
| `fix:`                                             | Bug fix or race-condition resolution          |  **Patch** (`v1.0.X`)  |
| `perf:`                                            | Performance or cloud cost optimization        |  **Patch** (`v1.0.X`)  |
| `docs:` / `chore:` / `refactor:` / `test:` / `ci:` | Documentation, dependencies, tests, workflows |  **Patch** (`v1.0.X`)  |

```bash
git add .
git commit -m "feat(summary): unify deterministic Player of the Match across scorer and viewer"
```

### Step 5: Sync with `origin/main` & Push

```bash
git fetch origin main && git merge origin/main --no-edit
git push -u origin HEAD
```

### Step 6: Open a Pull Request & Verify Required Status Checks

| Required CI / Security Job                                | Workflow                                             | Must Pass Before Merge |
| :-------------------------------------------------------- | :--------------------------------------------------- | :--------------------: |
| `Infrastructure & Secrets Security` (`validate_security`) | `ci.yml` (GitLeaks + Checkov)                        |         ✅ Yes         |
| `Lint & Test` (`validate_frontend`)                       | `ci.yml` (Trivy + ESLint + 151 Vitest + Build)       |         ✅ Yes         |
| `Backend & Terraform Validation` (`validate_backend`)     | `ci.yml` (121 Vitest + Trivy + `terraform validate`) |         ✅ Yes         |
| `Python AI & ML Validation` (`validate_python`)           | `ci.yml` (75 AI + 29 ML Pytest + Trivy)              |         ✅ Yes         |
| `Analyze (javascript-typescript)` & `Analyze (python)`    | `codeql.yml` (GitHub CodeQL SAST)                    |         ✅ Yes         |

```bash
gh pr create --title "feat(summary): unify deterministic Player of the Match" \
             --body "Summary of changes, root cause, and validation results." \
             --base main

gh pr checks
gh api repos/venkatesh-singamsetty/cricscore/pulls/<PR_NUMBER>/comments
```

### Step 7: Squash Merge & Automated Production Release

Once all required PR checks are green, squash-merge into `main`. GitHub Actions automatically executes:

1. **`CI` (`deploy_and_test_dev`)**: Deploys `dev`, runs DB migrations, AI evaluation, Playwright E2E, and OWASP ZAP DAST.
2. **`Semantic Release` (`release.yml`)**: Cuts the next `v*` tag, updates `docs/changelog.md`, and publishes enriched GitHub Release notes.
3. **`CD` (`cd.yml`)**: Deploys the tagged release to `prod` (`https://cricscore.venkateshsingamsetty.com`), runs Playwright E2E, and runs OWASP ZAP against `prod`.

---

## 🛡️ Governance Rules Summary

| Rule                                           | Policy                                                                      |
| :--------------------------------------------- | :-------------------------------------------------------------------------- |
| **Direct pushes to `main`**                    | ❌ Blocked by GitHub Branch Protection                                      |
| **Merging with failing CI / CodeQL checks**    | ❌ Blocked by Required Status Checks                                        |
| **Local deployment without `--use-local-env`** | ❌ Prohibited (`./infra/scripts/deploy.sh --env dev --use-local-env`)       |
| **Leaving open Dependabot PRs behind**         | ❌ Consolidate with `./infra/scripts/consolidate_dependabot_prs.sh --merge` |
| **Updating tests & docs with code changes**    | ✅ Mandatory in the same PR                                                 |
