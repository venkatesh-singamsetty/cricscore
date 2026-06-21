# 🛡️ Application Security & Posture Tradeoffs

This document explicitly records the intentional architectural compromises and accepted security risks made in the CricScore platform. 

As a guiding principle, the CricScore architecture prioritizes **Zero-Cost Operation ($0/month)** and **Application Functionality (React/SPA viability)**. When enterprise-grade security tools conflict with these two pillars, they are intentionally omitted or relaxed.

---

## 🛑 Active Threat Protection (Runtime & Edge)

### 1. Real-Time Execution Protection (AWS WAF & RASP)
**Status:** ❌ Intentionally Omitted  
**The Tradeoff:** We do not have real-time edge protection (WAF) or internal execution monitoring (RASP) to instantly block active SQL Injection (SQLi) or Cross-Site Scripting (XSS) attacks.
**The Reason (Cost & Performance):** 
- **AWS WAF** is excluded from the Free Tier and costs a baseline of **$5.00/month**. 
- **RASP** requires injecting heavy APM agents into AWS Lambda, which severely degrades "cold start" times, violates our sub-100ms performance goal, and requires paid enterprise licenses.
**The Mitigation:** The Aiven PostgreSQL driver uses strict parameterized queries natively (neutralizing SQLi), and our serverless architecture removes physical OS vulnerabilities.

---

## 🌐 Frontend & Browser Security Headers

### 2. Content Security Policy (CSP) Restrictions
**Status:** ⚠️ Intentionally Relaxed  
**The Tradeoff:** Our CSP explicitly allows `'unsafe-inline'` for scripts and styles, theoretically lowering defense against advanced DOM-based XSS. ZAP scanners flag this.
**The Reason (Functionality):** React physically requires the ability to inject dynamic inline styles and scripts into the DOM to render the SPA. Without `'unsafe-inline'`, the screen goes completely blank.
**The Mitigation:** React automatically escapes all string variables in JSX.

### 3. Cross-Origin Isolation (COEP / COOP / CORP)
**Status:** ❌ Intentionally Omitted  
**The Tradeoff:** We do not enforce strict Cross-Origin-Embedder, Opener, or Resource policies. 
**The Reason (Functionality):** Strict Cross-Origin isolation instantly blocks external CDNs, Google Fonts, and AWS API Gateway WebSockets from loading.
**The Mitigation:** Strict CORS (`Access-Control-Allow-Origin`) at the AWS API Gateway level ensures only our official domain can fetch backend data.

### 4. Sub-Resource Integrity (SRI)
**Status:** ❌ Intentionally Omitted  
**The Tradeoff:** `<script>` tags lack cryptographic hashes verifying file integrity.
**The Reason (Build Agility):** Vite does not inject SRI by default. Because our assets are served from our own locked-down AWS S3 bucket (not a public CDN), hijacking risk is negligible.

---

## ⚙️ CI/CD & Pipeline Governance

### 5. Relaxed Infrastructure Auditing (`.checkov.yaml`)
**Status:** ⚠️ Intentionally Relaxed  
**The Tradeoff:** Checkov flags our S3 buckets for lacking access logging (`CKV_AWS_18`) and versioning (`CKV_AWS_21`).
**The Reason (Cost):** Enabling these generates continuous AWS storage costs. We explicitly disabled them in Terraform and skipped the rules in Checkov to enforce our $0/month Free Tier mandate.

### 6. Pipeline Stability vs Upstream Deprecations
**Status:** ⚠️ Intentionally Bypassed  
**The Tradeoff:** We forcibly upgrade runner environments (`actions/checkout@v7`) and silence internal deprecation warnings (`NODE_OPTIONS: "--no-deprecation"`).
**The Reason (CI/CD Stability):** Legacy third-party Docker images (like OWASP ZAP) rely on deprecated native Node modules (e.g., `punycode`). We silence these to keep CI/CD logs clean and actionable.

### 7. Explicit Git Bypasses (`.gitignore` & `.gitleaksignore`)
**Status:** 🔒 Intentionally Bypassed  
**The Reason (Cleanliness):**
- **`.zip` Artifacts**: `deploy.sh` generates Lambda binaries. We ignore them to prevent Git repository bloat.
- **`.gitleaksignore`**: We explicitly whitelist specific historical git commits where dummy `.pem` test files or local terraform state keys were temporarily tracked, ensuring the aggressive Gitleaks scanner does not block active deployments.

### 8. Defense in Depth (Local Hooks vs. GitHub Actions)
**Status:** 🛡️ Strictly Enforced
**The Strategy:** We deliberately duplicate security scans (like `gitleaks` for secrets and `vitest` for code integrity) across three layers to prevent local bypasses:
1. **Pre-Commit (First Line of Defense)**: Hooks stop secrets from ever entering your local `.git` history instantly.
2. **Pre-Push (Safety Net)**: Hooks catch secrets/failing tests locally before network transmission, saving developer time.
3. **GitHub Actions (Ultimate Gatekeeper)**: Because local hooks can fail (e.g., missing dependencies) or be intentionally bypassed (`--no-verify`), GitHub Actions run in a centralized environment. They serve as an un-bypassable lock protecting the `main` branch from regressions and leaks.

---

## Conclusion
By intentionally accepting these specific, low-probability risks, CricScore maintains a **100% free cloud footprint** while delivering a highly dynamic, modern React experience. All DAST pipeline warnings related to these items (rules `10055`, `90003`, `10017`, `90004`, `10109`, `10049`, and `10050`) have been permanently muted in the `.zap/rules.tsv` configuration.
