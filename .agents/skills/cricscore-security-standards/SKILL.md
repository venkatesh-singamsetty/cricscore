---
name: cricscore-security-standards
description: Security guidelines and standards for secrets management, scanning, and secure coding practices.
---

# CricScore Security Standards

## 1. Secrets Management

- **Zero Hardcoded Secrets**: Never commit API keys, database credentials, or private tokens to code or Terraform variables.
- **SSM Parameter Store**: Store environment configurations in SSM Parameter Store (`/cricscore/dev/*` or `/cricscore/prod/*`) as standard parameters.
- **GitHub Secrets**: Inject deployment keys safely via GitHub Repository Secrets.

## 2. Scanning & Validation

- **Automated Scanning**: Run GitLeaks locally (`gitleaks protect -v`) before pushing code.
- Ensure Trivy vulnerability scans pass for backend and frontend.
