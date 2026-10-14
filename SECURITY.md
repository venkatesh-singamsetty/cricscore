# 🛡️ Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability within CricScore, please **do not report it in a public GitHub Issue**. Instead, send a private security report to:

📧 **Security Contact:** [venkatesh.singamsetty@gmail.com](mailto:venkatesh.singamsetty@gmail.com)

Please include:

- A description of the vulnerability and its potential impact.
- Step-by-step instructions to reproduce the issue.
- Any proof-of-concept scripts or payload examples.

We take security vulnerabilities seriously and will acknowledge receipt of your report within **24 hours**.

---

## 🔒 Security Posture & Architecture Summary

CricScore enforces enterprise-grade security controls at every layer:

| Security Domain            | Defense Controls                                                                                                                                          |
| :------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication**         | AWS Cognito User Pools with RS256 JWT signatures & short-lived access tokens                                                                              |
| **API Authorization**      | Amazon API Gateway JWT Authorizers protect selected HTTP routes; public HTTP routes and the current WebSocket routes do not use API Gateway authorization |
| **Secret Protection**      | Zero hardcoded keys in source code; secrets stored in GitHub Repository Secrets and injected securely via Terraform                                       |
| **Static Code Analysis**   | GitHub CodeQL JavaScript/TypeScript analysis on pull requests targeting `main`, pushes to `main`, weekly, and manual runs                                 |
| **Secret Leak Prevention** | GitLeaks scans staged files in the local pre-commit hook and the repository in CI                                                                         |
| **Dependency Security**    | CI runs Trivy filesystem scans on frontend and backend Lambda dependencies for fixable HIGH and CRITICAL findings                                         |
| **Dynamic Testing (DAST)** | OWASP ZAP Baseline Security Scan automated in CD deployment pipelines                                                                                     |
| **Supply Chain**           | Syft automated SPDX Software Bill of Materials (SBOM) generation                                                                                          |
| **Database Security**      | TLS-encrypted Aiven PostgreSQL with schema-level dev/prod data isolation                                                                                  |

For full architectural details, see our **[Security Posture & Tradeoffs Guide](./docs/security_posture.md)**.

---

© 2026 CricScore Security. 🏎️🏁🚀
