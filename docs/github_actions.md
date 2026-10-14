# GitHub Actions Architecture

This document describes the workflows currently present in `.github/workflows/`.

## Workflow files

GitHub Actions workflow files are stored directly in `.github/workflows/`:

| Workflow               | Trigger and purpose                                                                                                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`               | Runs on pull requests, pushes to `main`, and manual dispatch. Validates frontend, backend, and infrastructure changes. On `main` pushes and manual dispatches, it also deploys to DEV and runs post-deployment checks. |
| `cd.yml`               | Runs for version tags (`v*`) or manual dispatch with a tag input. Deploys to PROD, then runs AI evaluation, E2E tests, and a ZAP baseline scan.                                                                        |
| `release.yml`          | Runs after a successful `CI` workflow on `main`, or by manual dispatch, to create a semantic release.                                                                                                                  |
| `codeql.yml`           | Runs CodeQL analysis on pull requests and pushes to `main`, weekly, and by manual dispatch.                                                                                                                            |
| `drift.yml`            | Runs scheduled Terraform drift checks and can be started manually.                                                                                                                                                     |
| `keepalive.yml`        | Scheduled database keepalive workflow.                                                                                                                                                                                 |
| `mlops-pipeline.yml`   | Trains and evaluates the win-prediction model when ML engine files change, monthly, or by manual dispatch; uploads model artifacts.                                                                                    |
| `sbom.yml`             | Generates and uploads an SPDX SBOM on pushes to `main`, weekly, or by manual dispatch.                                                                                                                                 |
| `terraform-unlock.yml` | Manual workflow for unlocking Terraform state.                                                                                                                                                                         |

Dependabot configuration is separate from workflows and belongs at
`.github/dependabot.yml`.

## Validation and deployment flow

### Pull requests and pushes to `main`

`ci.yml` first runs frontend validation, backend tests and dependency scanning,
and repository/IaC security checks. Pull requests stop after validation; they do
not deploy or run Playwright E2E tests.

For pushes to `main` and manual dispatches, the workflow also runs the DEV
deployment job after validation. That job runs the DEV database migrations,
plans and applies Terraform, builds the frontend with DEV settings, uploads the
bundle to S3, and invalidates CloudFront. It then runs AI evaluation, Playwright
tests against DEV, and the configured ZAP baseline scan.

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

## Environment-specific frontend builds

Vite embeds `VITE_*` values in the frontend bundle at build time. The CI
deployment jobs therefore build the frontend separately with the target
environment's API, WebSocket, and Cognito configuration. The frontend bundle
is uploaded to S3, and CloudFront is invalidated after upload.

## Security checks

- `ci.yml` runs GitLeaks and Checkov, Trivy dependency scans, frontend/backend
  tests, and Terraform formatting and validation.
- `codeql.yml` performs JavaScript/TypeScript CodeQL analysis for pull requests,
  pushes to `main`, scheduled runs, and manual dispatches.
- `cd.yml` runs the configured OWASP ZAP baseline scan against Production;
  `ci.yml` runs the corresponding scan against DEV after deployment.
- `sbom.yml` creates an SPDX-format SBOM and uploads it as a workflow artifact.
