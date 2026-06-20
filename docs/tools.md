# 🛠️ Toolchain & Security Stack

This document outlines all the tools, frameworks, and security scanners utilized in the CricScore platform, categorized by their primary purpose.

---

## 1. Core Development (Frontend)

| Tool | Purpose |
|---|---|
| **Node.js / npm** | The core runtime environment and package manager used for frontend dependencies and local scripts. |
| **Vite** | The ultra-fast frontend build tool and local development server, providing Hot Module Replacement (HMR). |
| **React** | The declarative UI library used to build the single-page application (SPA). |
| **TypeScript** | Adds strong static typing to JavaScript, preventing runtime errors and improving IDE autocomplete. |
| **Vitest** | The testing framework used for frontend unit tests, deeply integrated with the Vite build system. |

---

## 2. Infrastructure & Cloud

| Tool | Purpose |
|---|---|
| **Terraform** | The Infrastructure as Code (IaC) tool used to declare, provision, and manage AWS resources (API Gateway, Lambda, S3, DynamoDB) and Aiven PostgreSQL databases. |
| **AWS CLI** | Command-line interface for direct AWS interactions, credential management, and running the `aws s3 sync` deployment commands. |
| **GitHub Actions** | The CI/CD automation runner. Executes linting, testing, and terraform applies dynamically on Pull Requests and branch merges. |

---

## 3. Application Security (AppSec)

| Tool | Type | Purpose |
|---|---|---|
| **GitLeaks** | Secrets Detection | Runs locally and via GitHub Actions to scan the commit history. It blocks any code containing accidentally hardcoded API keys, AWS credentials, or database passwords from being merged. |
| **Checkov** | IaC Security (SAST) | Audits the Terraform codebase before it is applied to ensure AWS best practices (e.g., encryption at rest, least-privilege IAM roles, secure S3 buckets). |
| **CodeQL** | Code Security (SAST) | GitHub's native semantic analyzer. Scans the TypeScript and JavaScript code for logical vulnerabilities like Cross-Site Scripting (XSS), SQL injection, and path traversal. |
| **Trivy** | Software Composition (SCA) | Scans the `package-lock.json` and Lambda zip dependencies for known vulnerabilities (CVEs) with `HIGH` or `CRITICAL` severity ratings. |
| **OWASP ZAP** | Runtime Security (DAST) | "Black-box" dynamic security tester. It actively attacks the live, deployed API endpoints (REST & WebSockets) to find runtime vulnerabilities that static analysis might miss. |
| **Dependabot** | Dependency Updates | Automatically monitors npm packages and Terraform providers, raising Pull Requests whenever a security patch or minor version update is available. |
