# 📅 CricScore: Full Project Timeline & Release Log

This document tracks the complete evolutionary history of the CricScore platform.

## 🛡️ v2.6.0: Security & Compliance Release [2026-06-20]

### CodeQL Security Hardening
* **XSS Mitigation**: Replaced direct `window.location.href` manipulation with secure, encoded fallback URL assignments to prevent DOM-based XSS when parsing the `emailTo` variable.
* **CSRF / SSRF Prevention**: Wrapped all dynamic `matchId` segments in `fetch()` calls with `encodeURIComponent()` to block malicious path traversal.
* **TLS Enforcements**: Removed insecure `NODE_TLS_REJECT_UNAUTHORIZED = '0'` from the backend Lambdas while preserving Aiven DB connectivity, satisfying CodeQL strict SSL verification.
* **Log Forging Protection**: Stripped out raw, unvalidated WebSocket payloads from client console logs to prevent log injection vectors.
* **Code Cleanliness**: Eliminated unused variables flagged by CodeQL static analysis.

---

## 🌍 v2.5.0: Open Source Release Readiness [2026-06-20]

### Public Anonymization & Security
* **Environment Parameterization**: Completely eradicated personal domain names, emails, and AWS infrastructure details from the version-controlled codebase. Replaced hardcoded values with dynamic `.env` injection at both the Frontend and Terraform layers.
* **Open Source Templates**: Introduced mirror `.env.local.example` and `frontend/.env.example` to provide clear, zero-secret setup guidance for external contributors.
* **Documentation Scrubbing**: Cleared `cost_management.md`, `troubleshooting.md`, and `deployment.md` of personal identifiers, replacing them with generic `example.com` placeholders while maintaining instructional integrity.

### Infrastructure Agility
* **Dynamic Pipeline Routing**: Upgraded `deploy.sh` to seamlessly map local `ADMIN_EMAIL` into Terraform's pipeline, ensuring backward compatibility without exposing secrets.
* **Namespace Standardization**: Unified the entire application under the clean `cricscore` namespace, including migrating legacy cache keys.

---

## 🚀 v2.4.0: Developer Experience & Infrastructure Unification [2026-06-20]

### Automated Environment Bootstrapping
* **Intelligent Setup Pipeline**: Completely rebuilt `scripts/setup.sh` into an OS-aware (macOS/Linux) installer. It now automatically detects and installs missing mission-critical tools (`node@24`, `terraform`, `aws-cli`, `jq`) using native package managers (`brew`/`apt`).
* **Deprecation Cleanup**: Deleted obsolete scripts (`setup.ps1`, `sync-env.sh`) to reduce maintenance surface area.

### Configuration & Deployment Resilience
* **ALL CAPS Unification**: Enforced a strict, universal ALL CAPS variable convention (e.g., `DOMAIN_NAME`, `TF_DATABASE_URL`) that perfectly aligns local `.env.local` files with GitHub Repository UI standards.
* **Terraform Under-the-Hood**: Upgraded `deploy.sh` to automatically translate and map these beautiful uppercase variables into the messy lowercase `TF_VAR_` syntax Terraform secretly requires, protecting the developer experience.
* **Non-Destructive Frontend Syncing**: `deploy.sh` now intelligently *appends* live AWS API Gateway URLs to `frontend/.env` instead of overwriting the file. This perfectly preserves manual local variables like `VITE_ADMIN_PIN` without requiring redundant entries in `.env.local`.

### CI/CD & Documentation Modernization
* **Dynamic Pipeline Hydration**: Eradicated hardcoded infrastructure parameters (domains, namespaces) from the `.github/workflows/backend-infra.yml` file. The CI/CD pipelines now hydrate completely dynamically from GitHub Repository Variables (`vars.DOMAIN_NAME`).
* **Zero-Cost Guarantees**: Updated Cost Management docs to explicitly record the $0-cost architectural optimizations deployed via Terraform (disabling S3 Versioning and DynamoDB Point-in-Time Recovery).
* **Agnostic Documentation**: Sanitized all architecture, API, and deployment markdown files to permanently remove hardcoded structural version labels (like `v2.0`), significantly reducing future maintenance overhead.

---

## 🛡️ v2.2.0: Enterprise CI/CD, Security Hardening & Public Release [2026-06-16]

### CI/CD Pipeline Restructuring
* **Consolidated Workflows**: Merged 5 scattered workflow files into 3 component-centric pipelines following enterprise standards:
  - [`frontend.yml`](.github/workflows/frontend.yml): Frontend lint, Trivy scan, unit tests, build validation (PR gate) → S3 sync + CloudFront invalidation (main-only deploy).
  - [`backend-infra.yml`](.github/workflows/backend-infra.yml): Lambda dependency check, Trivy scan, Terraform format/validate, Checkov IaC audit (PR gate) → Terraform apply (main-only deploy).
  - [`codeql.yml`](.github/workflows/codeql.yml): Standalone SAST analysis kept separate to avoid delaying fast CI feedback loops.
* **Branch Isolation**: Deploy jobs use `if: github.ref == 'refs/heads/main'` — feature branch PRs trigger only validation, never deployment.
* **Concurrency Groups**: `cancel-in-progress: true` on all workflows to prune stale runs and conserve runner minutes.
* **Least-Privilege Permissions**: All jobs scoped to `permissions: contents: read` at workflow level; CodeQL uses `security-events: write` only on the analyze job.

### Security Scanning Integrations
* **Checkov**: Terraform IaC static analysis in `backend-infra.yml` with `soft_fail: true` — flags misconfigurations without blocking pipelines.
* **Trivy**: Filesystem vulnerability scanning (`HIGH,CRITICAL` severity, `ignore-unfixed: true`) in both frontend and backend pipelines.
* **CodeQL**: Native SAST code scanning for JavaScript/TypeScript. Configured to upload results directly to GitHub Code Scanning tab (public repo — no GHAS license required). Runs on push, PRs, and weekly Thursday schedule.
* **Dependabot**: Daily automated dependency updates across `/frontend`, `/backend/lambdas/*`, and `/terraform`.

### Branch Protection Rules (main)
* Enabled native GitHub branch protection on `main` (possible after making repository public):
  - Requires all 3 CI checks to pass: `Lint & Test`, `Backend & Terraform Validation`, `Analyze Code (javascript-typescript)`.
  - Strict mode: branch must be up to date with `main` before merging.
  - Prevents force pushes and branch deletions.
  - No required PR approvals (solo developer — review gate would block all merges).
* `enforce_admins: false` — owner can bypass with `--admin` flag in emergency rollback scenarios.

### Dependency Upgrades (Dependabot)
* React `19.2.6` → `19.2.7` + manually aligned `react-dom` to `19.2.7` (version mismatch caused blank page crash in production).
* `eslint-plugin-react-refresh` → `0.5.3`
* `pg` driver → `8.21.0` (`match-api` and `storage-worker`)
* `@aws-sdk/client-sns` → `3.1069.0` (`score-update`)

### Repository
* Made repository **public** to enable native CodeQL Code Scanning and branch protection rules on the free GitHub tier.

---


## 🏏 v2.0.2: Timeline Standardization & Cricket Laws Compliance [2026-06-16]
* **Standardized Event Timeline**: Harmonized timeline display across both completed scorecards and live scorers. All special events now display as `<Type>` or `<Type>+<runs>` (e.g., `W`, `W+1`, `Wd`, `Wd+1`, `Nb`, `Nb+2`, `B+1`, `Lb+1`).
* **Bowler Wicket Crediting**: Corrected scoring rules off extra deliveries. Stumpings and Hit Wickets off Wide deliveries are now correctly credited as wickets to the Bowler, whereas other wickets off extras (such as run outs) are not.
* **No-Ball Dismissal Restrictions**: Disabled caught-out options off No-balls in accordance with the Laws of Cricket. Only valid dismissals (such as Run Out) are permitted.
* **API Routing & IAM Permissions**: Resolved email dispatch failures by appending `ses:SendEmail` and `ses:SendRawEmail` actions to the Lambda role and adding missing `DELETE /match/{matchId}` and `POST /match/{matchId}/email` routes to the API Gateway.

---

## 👥 v2.0.1: Team Sizes, Quotas & Scoreboard Enhancements [2026-06-05]
* **Custom Team Sizes & All-Out Logic**: Added dynamic innings end detection for teams with fewer than 11 players. Innings end automatically when fewer than 2 active batters remain capable of batting, preventing infinite select loops.
* **Bowler Over Quotas**: Enforced over-quotas (`Total Match Overs / 5`) with UI warnings and disabled selects.
* **Maiden Over Detection**: Fixed overs containing Wides or No-balls being counted as maidens.
* **Scorecard Display**: Integrated Hit Wicket display formats and fixed Retired Hurt showing bowler attribution.

---

## ⚡ v2.0.0: Decoupled Fan-Out Architecture [2026-03-31]
* **AWS SNS Event Hub**: Completely decoupled the `score-update` lambda from synchronous database writes, allowing Scorers to experience sub-100ms UI response times.
* **AWS SQS Reliability Buffer**: Implemented an asynchronous message queue to protect Aiven PostgreSQL from match-day ingestion spikes.
* **Storage Worker**: Provisioned a dedicated serverless worker to handle all ACID-compliant persistence and event scheduling.
* **Universal Broadcaster Hub**: Refactored the WebSocket broadcaster to instantly trigger directly from SNS payloads, bypassing traditional data indexing latency.
* **Infrastructure Integrity Fixes**: Resolved strict Node v24 Aiven TLS rejections (`SELF_SIGNED_CERT_IN_CHAIN`), fully automated deployment hydration boundaries, and structurally debounced React `useRef` race conditions during high-impact rapid scoring bursts.

---

## 🐛 v1.6.0: Bug Fixes & Data Integrity [2026-04-10]
* **Match Hub Innings Scores**: Fixed scores displaying under the incorrect team when the visiting team batted first.
* **Innings Completion States**: Ensured `is_completed` is set to `TRUE` on innings end and match completion.
* **Winner Persistence**: Persisted `match_winner` to PostgreSQL upon match completion.
* **Email Race Conditions**: Derived final email results directly from the frontend state to ensure accurate "Completed" statuses.
* **Viewer Hub WS Synchronizations**: Added live WebSocket updates when a new 2nd innings starts.

---

## 📜 Historical Changelog (v1.0.0 - v1.5.2)

* **2026-03-30 (v1.5.2)**: **Deep-Link Restoration & Sharing Finalization**: Sharable links (`?matchId=xxx`) instantly route to active scoreboards.
* **2026-03-30 (v1.5.0)**: **Strategic Pivot: Viral Sharing**: Transitioned from email-only reporting to an Instant Sharable Match Link system.
* **2026-03-26 (v1.4.0)**: **Production Release**: Decoupled Admin and Scorer email dispatch to bypass SES Sandbox restrictions.
* **2026-03-26 (v1.3.0)**: **Enterprise Multi-Tenant Isolation**: Implemented per-user match persistence and match-specific live caches.
* **2026-03-25 (v1.2.0)**: **Production Release**: Finalized production convergence from `develop` to `main`.
* **2026-03-23 (v1.1.0)**: **Persistence & UI Patches**: Fixed "empty analytics" bug and "white screen" spectator views by adding React keys and forced tab-refreshing.
* **2026-03-22 (v1.0.0)**: **Kickoff**: Aiven PostgreSQL persistence and real-time WebSocket broadcasting verified.
