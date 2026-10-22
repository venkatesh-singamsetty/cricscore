# 🛠️ Toolchain & Security Stack

This document outlines all the tools, frameworks, and security scanners utilized in the CricScore platform, categorized by their primary purpose.

---

## 1. Core Development & Testing

| Tool                       | Purpose                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Node.js / npm**          | The core runtime environment and package manager used for project dependencies and local scripts.         |
| **Vite**                   | The ultra-fast frontend build tool and local development server, providing Hot Module Replacement (HMR).  |
| **React**                  | The declarative UI library used to build the single-page application (SPA).                               |
| **TypeScript**             | Adds strong static typing to JavaScript, preventing runtime errors and improving IDE autocomplete.        |
| **ESLint**                 | Static code analysis tool used alongside Prettier to identify problematic patterns in JS/TS code.         |
| **Vitest**                 | The core testing framework used for both frontend (Unit/Integration) and backend (Unit/API) testing.      |
| **Pytest**                 | Python testing framework for validating the ML engine and Agentic AI service.                             |
| **XGBoost & Scikit-Learn** | Machine learning libraries for live win probability prediction and multi-algorithm benchmarking.          |
| **MLflow & DVC**           | Experiment tracking, model metrics logging, and dataset version control for the MLOps pipeline.           |
| **React Testing Library**  | Used to mount React components in a virtual DOM to simulate user clicks and inputs for Integration tests. |
| **Playwright**             | End-to-End (E2E) testing framework used to spin up a real browser and simulate complex user journeys.     |
| **aws-sdk-client-mock**    | Used for mocking AWS services (like DynamoDB and SNS) during backend event-driven unit testing.           |

---

## 2. Infrastructure & Cloud

| Tool               | Purpose                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Terraform**      | The Infrastructure as Code (IaC) tool used to declare, provision, and manage AWS resources (API Gateway, Lambda, S3, DynamoDB) and Aiven PostgreSQL databases. |
| **AWS CLI**        | Command-line interface for direct AWS interactions, credential management, and running the `aws s3 sync` deployment commands.                                  |
| **GitHub Actions** | The CI/CD automation runner. Pull requests run validation jobs; deployment and Terraform apply run on `main` or the production release workflow.               |

---

## 3. Application Security (AppSec)

| Tool           | Type                       | Purpose                                                                                                                                                                                                            |
| -------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **GitLeaks**   | Secrets Detection          | Runs locally and via GitHub Actions to scan the commit history. It blocks any code containing accidentally hardcoded API keys, AWS credentials, or database passwords from being merged.                           |
| **CodeQL**     | Code Security (SAST)       | GitHub's native semantic analyzer. Scans the TypeScript and JavaScript code for logical vulnerabilities like Cross-Site Scripting (XSS), SQL injection, and path traversal.                                        |
| **Trivy**      | Software Composition (SCA) | CI scans the frontend and backend Lambda dependency trees for fixable `HIGH` or `CRITICAL` vulnerabilities; these scans must pass before the DEV deployment job can run.                                           |
| **Checkov**    | IaC Security (SAST)        | Audits the Terraform codebase before it is applied to ensure AWS best practices (e.g., encryption at rest, least-privilege IAM roles, secure S3 buckets) and explicitly blocks provisioning on unknown violations. |
| **OWASP ZAP**  | Runtime Security (DAST)    | Runs a baseline scan against the deployed site URL after Dev or Production deployment. The current workflow does not configure ZAP findings to fail the job.                                                       |
| **Syft**       | Supply Chain (SBOM)        | Automatically scans the repository to generate a Software Bill of Materials (SBOM) using the SPDX JSON format, providing deep visibility into application dependencies.                                            |
| **Dependabot** | Dependency Updates         | Automatically monitors npm packages and Terraform providers, raising Pull Requests whenever a security patch or minor version update is available.                                                                 |

---

## 4. Automation & Governance

| Tool                          | Purpose                                                                                                                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Husky & Lint-Staged**       | The pre-commit hook runs Prettier through `lint-staged` for matching staged files, then scans staged content with Gitleaks when installed. If Gitleaks is not installed, the hook warns and skips that scan. The pre-push hook runs `validate_local.sh --skip-e2e`. |
| **Prettier**                  | Opinionated formatter run on matching staged JavaScript, TypeScript, JSON, and Markdown files by `lint-staged` before commits.                                                                                                                                      |
| **Semantic Release**          | Automates the entire package release workflow including: determining the next version number, generating release notes, and publishing Git tags. It is driven purely by Conventional Commit messages (e.g. `feat:`, `fix:`).                                        |
| **Terraform Drift Detection** | A custom GitHub Action cron job (`drift.yml`) that runs `terraform plan` nightly across Dev and Prod autonomously without human gates to detect and alert if anyone bypasses infrastructure-as-code by making manual changes in the AWS Console.                    |
