# 🚀 CricScore v1.3.0 - Security & Aiven-Focus Release

This release introduces critical **Role-Based Access Control (RBAC)** features to protect match data integrity and overhauls the project documentation to highlight the **Aiven Free Tier** integration.

## 🛡️ Key Changes
### 1. PIN-Based Authorization Engine
- **Restricted Views**: Added an authorization layer to the **Scorer 🎮** and **Admin ⚡** tabs.
- **Session Persistence**: Implemented `sessionStorage` tracking to keep officials authenticated without repeated prompts during a single browser session.
- **Auto-Protection**: If a session expires or is unauthorized, users are automatically redirected to the read-only **Viewer 🌍** mode.
- **Configurable PINs**: Securely managed via `.env` variables (`VITE_SCORER_PIN`, `VITE_ADMIN_PIN`).

### 🔧 Infrastructure & Reliability
- **Terraform Resilience**: Fixed a Route53 DNS conflict by enabling `allow_overwrite` on the subdomain alias record, ensuring seamless zero-downtime updates.
- **Domain Alignment**: Standardized all internal and external links to use the official production subdomain: `cricscore.venkateshsingamsetty.site`.

### 📚 Documentation (Aiven Prioritization)
- **Top-Tier Aiven Focus**: Restructured `README.md` and the Technical Portal to prioritize the **Aiven Journey** and **Infrastructure Stack**.
- **Security Guide**: Added a dedicated section to `README.md` explaining the new authorization model for both fans and match officials.
- **Link Fixes**: Repaired deep-linking between Mermaid sequence diagrams and the main infrastructure journey documentation.

## 📦 Technical Breakdown
- **App.tsx**: Integrated `AuthModal` and session-based validation logic.
- **terraform/main.tf**: Added Route53 overwrite permissions.
- **.env**: Exposed customizable PIN configuration.
- **docs/**: Multiple markdown corrections for subdomain consistency.
