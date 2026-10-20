---
name: cricscore-security-standards
description: Use when changing authentication, authorization, database/API handling, secrets, dependencies, infrastructure exposure, or CricScore security scans.
---

# CricScore Security Standards

## 1. Secrets, Credentials & Git Hygiene

- **Zero Secrets in Git or Logs**: Never commit, print, or expose `.env.local`, `TF_DATABASE_URL`, `OPENAI_API_KEY` / `LLM_API_KEY`, AWS credentials, or Cognito tokens. Keep `.gitignore` protections intact for `.env*`, `*.tfstate*`, `tfplan`, `__pycache__/`, `*.pyc`, and `apps/ml-engine/venv/`.
- **State & Plan Sensitivity**: Terraform state (`terraform.tfstate`) and plan outputs (`tfplan`) contain sensitive environment variables. Never commit `tfplan` or print raw secret outputs.
- **Server-Side Secret Isolation**: Database credentials and LLM API keys must remain strictly inside backend Lambda environment variables; never expose them to the React frontend, browser storage, or error payloads.

## 2. Authentication, Authorization & Database Safety

- **Strict Read-Only AI Chat Guarantee**: The `/chat` endpoint is intentionally open without a JWT authorizer so fans and guests can use the assistant. However, client-supplied `isAdmin` flags in request bodies are strictly ignored: destructive tools (`delete_guest_data`, `delete_incomplete_matches`) are permanently disabled from chat execution loops to prevent prompt injection or flag spoofing. Admin data purges must be executed through authenticated Match Ops Admin Panel routes.
- **SQL Injection Prevention & Query Validation**: In `chat-api` (`execute_sql.js`), all LLM-generated queries are pre-validated to ensure a single `SELECT` or `WITH` statement, rejecting write/DDL keywords (`DELETE`, `UPDATE`, `DROP`, `ALTER`, `INSERT`) and dangerous functions (`pg_sleep`, `pg_read_file`, `dblink`), wrapped in a `BEGIN READ ONLY;` transaction with a 3-second statement timeout.
- **Admin-Protected Rulebooks**: `POST /rules/upload`, `GET /rules`, and `DELETE /rules` are guarded by API Gateway Cognito JWT authorizers and verified server-side (`auth.js`) for the `Admin` group or `ADMIN_REPORT_EMAIL`.
- **Model Manifest Integrity**: Prediction Lambda (`apps/ml-engine/predict.py`) computes and verifies the SHA-256 hash of `live_win_predictor_model.joblib` against `model_manifest.json` before deserialization.
- **Verified Identity Only**: Enforce authorization in backend Lambdas (`match-api`, `score-update`, `chat-api`) using verified Cognito JWT claims or validated guest/scorer session rules.
- **Safe Error Handling**: Return structured HTTP 4xx/5xx JSON responses without leaking stack traces, connection strings, or internal schema details.

## 3. Automated Security Scanners (Local & CI)

- **Pre-Commit (`husky` + `lint-staged`)**: Runs `gitleaks protect --staged --redact` on every commit.
- **Local Validation (`./infra/scripts/validate_local.sh`)**:
  - `npm audit --audit-level=high` (Frontend & Backend)
  - **Checkov** (`checkov -d infra/terraform/ --quiet`): IaC security scan (skip tags documented in `infra/terraform/`).
  - **GitLeaks** (`gitleaks detect --source . -v`): Full repository commit history secret scan.
  - **Trivy** (`trivy fs`): HIGH/CRITICAL vulnerability scan across `apps/frontend` and `apps/backend/lambdas`.
  - **Syft** (`syft dir:. -o spdx-json > cricscore-sbom.json`): SBOM generation.
- **GitHub Actions Security Gates (`.github/workflows/ci.yml` & `codeql.yml`)**:
  - **CodeQL Static Analysis**: Fails or comments on PRs for unused variables, injection risks, or unsafe patterns. Always check `gh api repos/venkatesh-singamsetty/cricscore/pulls/<PR>/comments` after pushing.
  - **OWASP ZAP Baseline DAST**: Runs against `dev` and `prod` after deployment using `.zap/rules.tsv`.
