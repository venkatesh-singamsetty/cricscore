# GitHub Actions Architecture

This document describes the workflows currently present in `.github/workflows/`.

## Workflow files

GitHub Actions workflow files are stored directly in `.github/workflows/`:

| Workflow               | Trigger and purpose                                                                                                                                                                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`               | Runs on pull requests, pushes to `main`, and manual dispatch. Validates frontend, backend, Python AI/ML services, and infrastructure changes. On `main` pushes and manual dispatches, it also deploys to DEV and runs post-deployment checks.            |
| `cd.yml`               | Runs for version tags (`v*`) or manual dispatch with a tag input. Deploys to PROD, then runs AI evaluation, E2E tests, and a ZAP baseline scan.                                                                                                          |
| `release.yml`          | Runs after a successful `CI` workflow on `main`, or by manual dispatch, to create a semantic release.                                                                                                                                                    |
| `codeql.yml`           | Runs CodeQL analysis on pull requests and pushes to `main`, weekly, and by manual dispatch across both `javascript-typescript` and `python` matrices.                                                                                                    |
| `drift.yml`            | Runs scheduled Terraform drift checks and can be started manually.                                                                                                                                                                                       |
| `keepalive.yml`        | Scheduled database keepalive workflow.                                                                                                                                                                                                                   |
| `mlops-pipeline.yml`   | Trains and benchmarks candidate models (Logistic Regression, Decision Trees, Random Forest, Extra Trees, HistGradientBoosting, XGBoost) when ML engine files change, monthly, or by manual dispatch; enforces quality gates and uploads model manifests. |
| `ml-model-release.yml` | Manual dispatch workflow for deploying or rolling back a specific model version (`MODEL_VERSION`) with SHA-256 verification and live smoke test.                                                                                                         |
| `sbom.yml`             | Generates and uploads an SPDX SBOM on pushes to `main`, weekly, or by manual dispatch.                                                                                                                                                                   |
| `terraform-unlock.yml` | Manual workflow for unlocking Terraform state.                                                                                                                                                                                                           |

Dependabot configuration is separate from workflows and belongs at
`.github/dependabot.yml`.

## Validation and deployment flow

### Pull requests and pushes to `main`

`ci.yml` executes four parallel validation gates on every Pull Request:

1. **`validate_security`**: GitLeaks secrets scan and Checkov Terraform IaC scan.
2. **`validate_frontend`**: TypeScript typecheck (`tsc --noEmit`), Vitest unit/component tests (75 tests), Trivy vulnerability scan, and dry-run production build.
3. **`validate_backend`**: Node.js Lambda unit tests (85 tests), Trivy vulnerability scan across all Lambda lockfiles, and Terraform format check & validation.
4. **`validate_python`**: Python 3.12 AI Service tests (57 tests), Python ML Engine tests with XGBoost artifact verification (24 tests), and Trivy vulnerability scan on Python dependencies.

Pull requests stop after these four validation jobs complete; they do not deploy or run Playwright E2E tests against live cloud environments.

For pushes to `main` and manual dispatches, the workflow also runs the DEV
deployment job (`deploy_and_test_dev`) after all four validation jobs pass. That job runs the DEV database migrations,
plans and applies Terraform, builds the frontend with DEV settings, uploads the
bundle to S3, and invalidates CloudFront. It then runs AI evaluation, Playwright
tests against DEV (14 E2E browser and API tests), and the configured ZAP baseline scan.

`release.yml` is a separate workflow triggered after a successful `CI` workflow
on `main`. It resets to the exact tested commit before running semantic release.
Although the workflow declares `workflow_dispatch`, its job condition checks for
a successful `workflow_run`; a manual dispatch by itself does not meet that
condition and skips the release job.

### Production releases

`cd.yml` deploys when a `v*` tag is pushed or when manually dispatched with a
tag input. It runs production database migrations, Terraform plan/apply, builds
the frontend with production settings, uploads it to S3, invalidates CloudFront,
then runs AI evaluation, Playwright E2E tests, and a ZAP baseline scan.

Whether a run pauses for approval depends on the protection rules configured
for the GitHub `prod` environment; the workflow file alone does not guarantee
manual approval.

### Infrastructure drift detection

`drift.yml` runs every midnight (and on manual dispatch) across both DEV and PROD
matrix legs using `terraform plan -detailed-exitcode`. It operates completely
autonomously without requesting the protected `prod` environment gate, because it
is strictly read-only and never mutates AWS infrastructure. If out-of-band drift
is detected, `terraform plan -detailed-exitcode` exits with code `2`, failing the
job and triggering instant GitHub email alerts.

## Environment-specific frontend builds

Vite embeds `VITE_*` values in the frontend bundle at build time. The CI
deployment jobs therefore build the frontend separately with the target
environment's API, WebSocket, and Cognito configuration. The frontend bundle
is uploaded to S3, and CloudFront is invalidated after upload.

## Security checks

- `ci.yml` runs GitLeaks and Checkov, Trivy dependency scans across npm and pip,
  frontend/backend/python tests, and Terraform formatting and validation.
- `codeql.yml` performs CodeQL static analysis for both `javascript-typescript` and `python`
  for pull requests, pushes to `main`, scheduled runs, and manual dispatches.
- `cd.yml` runs the configured OWASP ZAP baseline scan against Production;
  `ci.yml` runs the corresponding scan against DEV after deployment.
- `sbom.yml` creates an SPDX-format SBOM and uploads it as a workflow artifact.
