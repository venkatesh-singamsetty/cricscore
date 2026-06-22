# 🏏 CricScore: Real-Time Cricket Match Engine

### 🏏 High-Performance, Event-Driven Cricket Engine

[![AWS](https://img.shields.io/badge/AWS-Serverless-orange)](https://aws.amazon.com)
[![Event-Driven](https://img.shields.io/badge/SNS%2FSQS-Fan--Out-black)](https://aws.amazon.com/sns/)
[![Aiven](https://img.shields.io/badge/Aiven-Managed%20Services-blue)](https://aiven.io)
[![Version](https://img.shields.io/github/v/release/venkatesh-singamsetty/cric-score?color=indigo&label=CricScore)](./docs/changelog.md)

CricScore is a highly performant, serverless cricket engine designed for sub-100ms match updates. It leverages a decoupled, serverless event-driven stack (AWS SNS/SQS) for global real-time broadcasting.

🚀 **Live Production:** **https://cricscore.venkateshsingamsetty.site**

---

## 🔄 System Architecture (Fan-Out)

```mermaid
graph TD
    %% Global CDN Layer
    subgraph CDN [Global Delivery]
        CF[AWS CloudFront] --> S3[AWS S3: React App]
    end

    %% Cloud Logic
    subgraph AWS [AWS Serverless Stack]
        REST_GET[API Gateway: GET] --> match_api[match-api Lambda]

        REST_POST[API Gateway: POST] --> score_update[score-upd Lambda]
        score_update --> SNS{AWS SNS Topic}

        %% Consumer logic
        SNS -->|Reliability| SQS[[AWS SQS Queue]]
        SQS --> storage_worker[storage-worker Lambda]

        SNS -->|Fast-Path| broadcaster[broadcaster Lambda]

        %% WebSocket Gateway Hub
        WS_GW[API Gateway: WebSockets] -->|1. Trigger| onConnect[onconnect Lambda]
        WS_GW -->|1. Trigger| onDisconnect[ondisconnect Lambda]

        onConnect -->|2. Register| DDB[(DynamoDB Registry)]
        onDisconnect -->|2. Prune| DDB

        broadcaster -->|3. Data Push| WS_GW
        WS_GW -->|4. Stream| Fan
    end

    %% Data Hub vertically stacked for clear routing
    subgraph Aiven [Aiven Managed Data Hub]
        PG[(Aiven PostgreSQL)]
    end

    %% Explicit data routing
    match_api -->|Initial Setup| PG
    storage_worker -->|ACID Commit| PG

    %% User Interaction Labels
    Fan((Fan)) -.->|Request| REST_GET
    Fan -.->|Handshake| WS_GW
    Scorer((Scorer)) -.->|Post| REST_POST
```

---

## 👥 Platform Access Roles

- **Viewer 🌍**: Single-click access to global match discovery and real-time spectator hub (Public/No Auth).
- **Scorer 🎮**: Secure multi-tenant isolation for official ball-by-ball match scoring (Secure/Email Auth).
- **Admin ⚡**: Enterprise-grade persistence governance and match record purging (Protected/Admin PIN).

---

## ⚡ Local Environment & Testing

### 1. Prerequisite Installation

To run or deploy CricScore locally, you need Node.js, Terraform, AWS CLI, Checkov, and GitLeaks.
💡 **Pro-Tip:** You can automatically install all required tools on macOS or Linux by simply running:

```bash
./infra/scripts/setup.sh
```

### 2. Configuration & Deployment

Create a `.env.local` file at the root of the project to manage your local infrastructure deployment. _(These variables map exactly to the GitHub Actions requirements listed in the next section)._

- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_DEFAULT_REGION`
- `TF_DATABASE_URL`, `TF_SES_SOURCE_EMAIL`, `ADMIN_EMAIL`
- `DOMAIN_NAME`, `ZONE_DOMAIN`, `SUBDOMAIN_PREFIX`, `PROJECT_NAME`

To run the full stack locally, use the deployment script (this will automatically provision AWS and generate your required `apps/frontend/.env` URLs):

```bash
./infra/scripts/deploy.sh --use-local-env
```

👉 For comprehensive instructions, see the **[Full Deployment Guide](./docs/deployment.md)**.

### 3. Frontend Local Development

We provide a convenient root-level `package.json` that acts as a proxy to the `frontend/` directory so you don't have to change folders. Here is the local development lifecycle:

- **`npm run dev`**: The Sandbox. Use this 99% of the time. Starts a hyper-fast local server with Hot Module Replacement (HMR). Changes instantly appear when you save.
- **`npm run build`**: The Factory. Translates TypeScript, aggressively minifies CSS/JS, and squishes the app into a highly optimized `apps/frontend/dist/` folder for AWS production.
- **`npm run preview`**: The Rehearsal. Boots a local server pointing directly at the optimized `dist/` folder. Use this specifically to test exact production load speeds or debug minification issues before opening a PR.

### 4. Pre-Commit Validation

To prevent failing the strict GitHub Actions pipelines, validate your code locally before pushing:

```bash
# Frontend Validation
cd apps/frontend
npm run lint    # Catches unused variables and TS errors
npm run test    # Executes component unit tests
npm run build   # Validates the production bundle compiles
cd ..

# Infrastructure Validation
./infra/scripts/terraform.sh fmt -check -recursive  # Validates HCL formatting
./infra/scripts/terraform.sh validate               # Validates infrastructure logic
checkov -d terraform/                         # (Optional) Run local IaC security scans

# Secrets Detection
gitleaks detect --source . -v    # Detects accidental AWS keys or passwords
```

**⚠️ Optional Manual Dependency Scanning (Trivy)**
Trivy is not configured as an automatic pre-commit hook because downloading its massive vulnerability database locally on every commit severely degrades developer speed. It is strictly executed in the cloud pipelines.

If you are specifically debugging a dependency issue, you can scan locally:

```bash
# Requires: brew install trivy
trivy fs ./frontend --scanners vuln --severity HIGH,CRITICAL
trivy fs ./apps/backend/lambdas --scanners vuln --severity HIGH,CRITICAL
```

---

## 🔐 GitHub Actions (Production CI/CD)

To enable the automated deployment pipelines, configure the following in your GitHub repository settings (**Settings → Secrets and variables → Actions**).

**Repository Secrets (Sensitive):**

- `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY`: IAM credentials for provisioning.
- `TF_DATABASE_URL`: Aiven PostgreSQL connection string.
- `TF_SES_SOURCE_EMAIL`: Verified Amazon SES sender email.
- `VITE_ADMIN_PIN`: The secret PIN to protect the scorer dashboard.

**Repository Variables (Non-Sensitive):**

- `AWS_REGION` / `AWS_DEFAULT_REGION`: Deployment region (e.g., `us-east-1`). Both variables are required by Terraform/AWS CLI across workflows.
- `DOMAIN_NAME`, `ZONE_DOMAIN`, `SUBDOMAIN_PREFIX`, `PROJECT_NAME`: Infrastructure namespacing.
- `ADMIN_EMAIL`: Admin email address for SES match report emails.
- `API_GATEWAY_ID`, `WS_API_GATEWAY_ID`, `S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`: Cloud resource IDs/endpoints.
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`: Forces all GitHub Actions JS steps to use Node.js 24 runtime.

If these variables are not set, the workflow will emit a warning during the `Validate repository Variables` step.

---

## 🏢 Enterprise-Grade Architecture

CricScore implements a robust, Fortune 500-grade architectural posture across four key pillars:

### 1. 🛡️ DevSecOps & Security

- **SAST & IaC Auditing**: Enforced **Checkov** static security scans for Terraform configurations, uploading SARIF reports directly to GitHub Security.
- **Secrets & Identity**: **GitLeaks** mathematically guarantees no AWS keys or database passwords are ever committed.
- **DAST (Dynamic Scanning)**: Automated **OWASP ZAP** pipelines actively attack the live API to detect runtime vulnerabilities (e.g., XSS, SQLi).
- **Supply Chain Security**: Automated **SBOM** (Software Bill of Materials) generation and **Dependabot** tracking ensure Node.js and GitHub Action dependencies are monitored for CVEs, while **Trivy** scans container filesystems.

### 2. 🧪 Quality Assurance (Testing Pyramid)

- **Unit & Integration**: Unified **Vitest** architecture across the stack, utilizing `aws-sdk-client-mock` for isolated backend lambda testing, and **React Testing Library** for frontend component validation.
- **End-to-End (E2E)**: Automated **Playwright** flows spin up headless Chromium browsers to visually navigate the live application, ensuring critical user journeys never regress.

### 3. 📈 Observability & Resilience

- **Proactive Alarms**: AWS CloudWatch actively monitors API latencies and Lambda failure rates, triggering **SNS Topics** that instantly email administrators upon detection of anomalies.
- **Event-Driven Durability**: Live scoreboard broadcasts are decoupled from heavy database writes using **AWS SQS**. Dead Letter Queues (DLQs) guarantee zero data loss during high traffic spikes or Aiven database downtime.
- **Drift Detection**: Automated GitHub Actions run daily checks to ensure the live AWS environment has not drifted from the declared Terraform state, enforcing strict Infrastructure-as-Code compliance.

### 4. ⚙️ CI/CD & Release Management

- **Automated Deployments**: Infrastructure and application deployments to AWS only trigger on automated merges to the `main` branch.
- **Semantic Release**: The repository analyzes commit messages to automatically calculate semantic versions (e.g., `v3.1.2`), publish GitHub Releases, and generate changelogs entirely hands-free.

---

## 📖 Technical Documentation

### 1. 🛡️ Security & Identity

- **[Security Posture](./docs/security_posture.md)**: Defense in depth strategy, multi-tenant isolation, and encryption layers.
- **[Branch Protection & Governance](./docs/branch_protection.md)**: Required status checks, CI/CD pipeline blockers, and administrator enforcement.

### 2. 🔭 Observability & Monitoring

- **[Observability Suite](./docs/observability.md)**: CloudWatch Dashboards, X-Ray Tracing, Sentry Crash Reporting, and Uptime monitors.

### 3. 🏗️ Architecture & Engineering

- **[Detailed Architecture](./docs/architecture.md)**: System design, sequence flows, and EDA logic.
- **[API Guide](./docs/api.md)**: REST & WebSocket contract specifications.
- **[Aiven Managed Services](./docs/aiven.md)**: PostgreSQL database configuration and keep-alive strategy.
- **[Node.js Guide](./docs/nodejs_guide.md)**: ESM vs CommonJS standardizations.

### 4. 💰 Cost Optimization

- **[Cost & Performance](./docs/cost_management.md)**: Free-tier monitoring strategy and architecture scale limits.

### 5. ✅ Quality & Validation

- **[Testing Guide](./docs/testing.md)**: Vitest and Playwright test commands and E2E structures.
- **[Toolchain & Security Stack](./docs/tools.md)**: Master list of all CI/CD, IaC, and AppSec tools used in the pipeline.

### 6. ⚙️ Operations & DevOps

- **[GitHub Actions Architecture](./docs/github_actions.md)**: CI/CD Directory structure constraints and pipeline organization.
- **[Full Deployment & Infrastructure](./docs/deployment.md)**: Local preview, bootstrap foundations, and AWS/Aiven Setup.
- **[Automated Releases](./docs/release_process.md)**: Semantic release and Conventional Commit specifications.
- **[Full Project Log](./docs/changelog.md)**: Release records and development timeline.
- **[Troubleshooting](./docs/troubleshooting.md)**: Setup fixes and identity verification help.
