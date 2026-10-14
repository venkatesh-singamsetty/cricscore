# 🛡️ Enterprise Security Posture & Tradeoffs

This document explicitly records the intentional architectural compromises and accepted security risks made in the CricScore platform, balanced against our enterprise security foundations.

As a guiding principle, the CricScore architecture balances operating cost with application functionality. Some controls are omitted or relaxed; deployments can incur AWS and external-provider charges depending on configuration and usage.

---

## 🏗️ Enterprise Security Foundations

While we make specific cost-saving tradeoffs at the edge, the core architecture enforces strict enterprise-grade security constraints:

### 1. Identity & Access Management (IAM) Least-Privilege

AWS Lambda functions use Terraform-provisioned IAM roles. Policies grant access to the AWS services used by the application, including DynamoDB, SNS/SQS, WebSocket connections, SES, S3 backups, Cognito, and X-Ray. Some policies include wildcard resource scopes, so permissions should not be described as exclusively resource-scoped.

### 2. Branch Protection & GitHub Governance

The repository includes branch-protection guidance in [branch_protection.md](./branch_protection.md). Required checks, administrator enforcement, and force-push settings are configured in GitHub and should be verified there; they are not established by the workflow files alone.

### 3. Automated DevSecOps CI/CD Scanners

GitHub Actions run security checks on pull requests to `main`, including:

- **GitLeaks**: Scans for secrets in CI; the local pre-commit hook scans staged changes when GitLeaks is installed.
- **Trivy**: Filesystem scans frontend and backend Lambda dependencies for fixable HIGH and CRITICAL findings. CI does not run `npm audit`.
- **Checkov**: Statically analyzes Terraform logic to prevent IaC misconfigurations (e.g., public S3 buckets).
- **CodeQL**: Deep SAST analysis to detect logical vulnerabilities in our TypeScript code.
- **Syft**: Generates an SPDX JSON SBOM on pushes to `main`, weekly, and by manual dispatch.

---

## 🛑 Active Threat Protection (Runtime & Edge)

### 1. Real-Time Execution Protection (AWS WAF & RASP)

**Status:** ❌ Intentionally Omitted  
**The Tradeoff:** We do not have real-time edge protection (WAF) or internal execution monitoring (RASP) to instantly block active SQL Injection (SQLi) or Cross-Site Scripting (XSS) attacks.
**The Reason (Cost & Performance):**

- **AWS WAF** is not currently provisioned; adding it would introduce additional service costs.
- **RASP** requires injecting heavy APM agents into AWS Lambda, which severely degrades "cold start" times, violates our sub-100ms performance goal, and requires paid enterprise licenses.
  **The Mitigation:** The Aiven PostgreSQL driver uses strict parameterized queries natively (neutralizing SQLi), and our serverless architecture removes physical OS vulnerabilities.

---

## 🌐 Frontend & Browser Security Headers

### 2. Content Security Policy (CSP) Restrictions

**Status:** ⚠️ Intentionally Relaxed  
**The Tradeoff:** The configured CSP allows `'unsafe-inline'` for scripts and styles, which weakens protection against some injection attacks.
**The Reason (Functionality):** This is the current policy configuration; it should not be treated as a React requirement. Tighten the policy only after verifying application and third-party asset compatibility.
**The Mitigation:** React escapes text interpolated through JSX by default, but that does not replace a restrictive CSP or safe handling of HTML content.

### 3. Cross-Origin Isolation (COEP / COOP / CORP)

**Status:** ❌ Intentionally Omitted  
**The Tradeoff:** We do not enforce strict Cross-Origin-Embedder, Opener, or Resource policies.
**The Reason (Functionality):** Strict Cross-Origin isolation instantly blocks external CDNs, Google Fonts, and AWS API Gateway WebSockets from loading.
**The Mitigation:** API Gateway currently allows wildcard origins for HTTP API CORS; this is not an origin allowlist. Authentication and route-level authorization are separate controls and apply only to configured routes.

### 4. Sub-Resource Integrity (SRI)

**Status:** ❌ Intentionally Omitted  
**The Tradeoff:** `<script>` tags lack cryptographic hashes verifying file integrity.
**The Reason (Build Agility):** Vite does not inject SRI by default. Because our assets are served from our own locked-down AWS S3 bucket (not a public CDN), hijacking risk is negligible.

---

## ⚙️ CI/CD & Pipeline Governance

### 5. Relaxed Infrastructure Auditing (`.checkov.yaml` & Trivy)

**Status:** ⚠️ Intentionally Relaxed  
**The Tradeoff:** Checkov flags our S3 buckets for lacking access logging (`CKV_AWS_18`) and versioning (`CKV_AWS_21`). Trivy flags our CloudFront for missing WAF (`AWS-0011`), our logging S3 bucket for missing CMK encryption (`AWS-0132`), and our alerts SNS topic for missing CMK encryption (`AWS-0095`).
**The Reason (Cost):** Enabling these features can add service costs. The Terraform configuration includes documented scanner suppressions for selected findings; review those suppressions before changing the controls.

### 6. Pipeline Stability vs Upstream Deprecations

**Status:** ⚠️ Workflow compatibility setting present
**The Tradeoff:** The workflows set `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION: "true"`, which permits actions that use a Node.js runtime GitHub marks as unsecure.
**The Reason (CI/CD Stability):** Review and remove this setting when all actions in the workflows use supported runtimes.

### 7. Explicit Git Bypasses (`.gitignore` & `.gitleaksignore`)

**Status:** 🔒 Intentionally Bypassed  
**The Reason (Cleanliness):**

- **`.zip` Artifacts**: `infra/scripts/deploy.sh` generates Lambda binaries. We ignore them to prevent Git repository bloat.
- **`.gitleaksignore`**: We explicitly whitelist specific historical git commits where dummy `.pem` test files or local terraform state keys were temporarily tracked, ensuring the aggressive Gitleaks scanner does not block active deployments.

### 8. Defense in Depth (Local Hooks vs. GitHub Actions)

**Status:** 🛡️ Strictly Enforced
**The Strategy:** We deliberately duplicate security scans (like `gitleaks` for secrets and `vitest` for code integrity) across three layers to prevent local bypasses:

1. **Pre-Commit (First Line of Defense)**: The hook scans staged content with Gitleaks when Gitleaks is installed; otherwise it warns and skips the scan.
2. **Pre-Push (Safety Net)**: Hooks catch secrets, failing tests, NPM vulnerabilities (`npm audit`), and active Terraform state locks locally before network transmission, saving developer time.
3. **GitHub Actions**: Centralized checks run independently of local hooks. Whether they block merges depends on the repository's current GitHub branch-protection settings.

---

## Conclusion

These tradeoffs are documented to make the current controls and limitations explicit. Review the infrastructure and workflow configuration before deployment, and reassess controls against the deployment's security and cost requirements.
