---
name: cricscore-infrastructure-standards
description: Use when changing or deploying CricScore Terraform, AWS resources, state/backends, CI/CD infrastructure steps, or environment configuration.
---

# CricScore Infrastructure Standards

## Terraform and deployment

- Keep `dev` and `prod` state keys and environment variable files separate. Preserve the S3 backend's native lockfile configuration and required Terraform version.
- Format and validate Terraform before proposing changes: `./infra/scripts/terraform.sh fmt -check -recursive` and `./infra/scripts/terraform.sh validate`.
- Review a plan for the intended environment before applying. Check for replacement, deletion, state/backend changes, and database or user-data impact; do not assume an apply is harmless.
- `./infra/scripts/deploy.sh --env dev|prod --use-local-env` loads `.env.local`, installs dependencies, initializes Terraform, applies with auto-approve, builds the frontend, syncs S3, and invalidates CloudFront. It is a full deployment command, not a plan-only command. `--bootstrap-only` creates the initial state bucket and DNS zone; `--migrate` opts into database migrations. Use only the explicitly requested environment and confirm before production changes.
- Keep deployment steps and their actual CI equivalents aligned. CI runs database migrations before Terraform apply and frontend upload; inspect `.github/workflows/ci.yml` and `cd.yml` before changing release ordering.

## Lambda image deployment

- Follow the current image build and update flow in `infra/terraform/lambda.tf`; do not assume Terraform notices content changes behind a mutable tag.
- Keep container architecture, build platform, image tag handling, execution runtime, and Lambda configuration consistent. Add cleanup or retention rules deliberately so cost-saving changes do not remove an image still in use.

Run `./infra/scripts/validate_local.sh --skip-e2e` for the repository's local validation suite when the change warrants it. Never expose credentials in plans, logs, generated files, or commits.
