---
name: cricscore-infrastructure-standards
description: Best practices for AWS serverless infrastructure, drift detection, and local pre-testing to avoid redundant CI/CD failures.
---

# CricScore Infrastructure Standards

## 1. Infrastructure Drift & Governance

- Run Terraform formatting and validation checks locally:
  `terraform -chdir=infra/terraform fmt -check -recursive`
  `terraform -chdir=infra/terraform validate`
- Always review `terraform plan` outputs before applying infrastructure changes to DEV or PROD.

## 2. Docker & Lambda Architecture

- When deploying Lambda functions via Docker Image URI, use `null_resource` to force build and push on changes.
- Since Terraform string comparison on `:latest` tags doesn't detect changes, force the lambda to update via AWS CLI inside the `local-exec` provisioner:
  `aws lambda update-function-code --function-name <name> --image-uri <uri>:latest`
