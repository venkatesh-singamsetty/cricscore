# 🗄️ Aiven Managed PostgreSQL Setup Guide

CricScore uses **Aiven Managed PostgreSQL** (`pgvector` enabled) as its primary ACID relational and vector database. Both `dev` and `prod` environments share a single Aiven instance isolated by PostgreSQL schemas (`DB_SCHEMA=dev` and `DB_SCHEMA=prod`), pairing with the `~$1/month` AWS serverless footprint (`dev` + `prod` combined).

---

## 🏗️ Database Architecture & Keep-Alive Flow

```mermaid
flowchart TD
    subgraph GitHub["GitHub Actions (Daily 12:00 UTC)"]
        KA["keepalive.yml\n(1 Full Prod E2E Match + Prune Old E2E > 7)"]
    end

    subgraph AWS["AWS Serverless (~$1/mo Dev + Prod)"]
        DevL["Dev Lambdas\n(DB_SCHEMA=dev)"]
        ProdL["Prod Lambdas\n(DB_SCHEMA=prod)"]
    end

    subgraph Aiven["Aiven PostgreSQL (SSL Required)"]
        PG[("defaultdb\n├─ schema: dev\n├─ schema: prod\n└─ ext: vector")]
    end

    KA -->|"Playwright E2E + SQL Prune (OFFSET 7)"| ProdL
    DevL -->|"SSL Connection Pool"| PG
    ProdL -->|"SSL Connection Pool"| PG
```

---

## 📋 Why Aiven PostgreSQL?

- **ACID Transactions:**
  - Guarantees strict ball-by-ball cricket scoring consistency and eliminates race conditions or lost deliveries.
- **Schema Isolation (`DB_SCHEMA=dev` / `DB_SCHEMA=prod`):**
  - Isolates `dev` and `prod` tables inside a single database instance, avoiding duplicate managed database fees.
- **`pgvector` Extension:**
  - Powers semantic rulebook RAG search (`tournament_rules`) directly inside PostgreSQL without an external vector database.
- **Daily Production E2E Keep-Alive & 7-Match Retention (`.github/workflows/keepalive.yml`):**
  - Because Aiven Free Tier detects real disk/WAL write activity (and can still hibernate if only pinged with a read-only `SELECT 1`), `keepalive.yml` runs **1 full 2-over Playwright E2E match in Production (`tests/user-journey.spec.ts`)** daily at 12:00 UTC.
  - Automatically checks out the **latest published production release tag** (`v*`) so E2E test specs and locators accurately align with the deployed Production frontend and API, without false alarms from unreleased changes on `main`.
  - This generates genuine `INSERT`, `UPDATE`, and `DELETE` (Undo) transactions across `prod.matches`, `prod.innings`, `prod.players`, `prod.bowlers`, and `prod.ball_events`, provides daily production synthetic monitoring, and automatically prunes older E2E test matches (`OFFSET 7`) so only the **latest 7 E2E test matches** are retained in `prod`.

---

## 🔒 Connection Security Best Practices ($0.00 Free Hardening)

CricScore implements defense-in-depth security controls between AWS serverless compute and Aiven PostgreSQL without incurring paid VPC / PrivateLink costs:

1. **In-Transit TLS Encryption & Strict Root CA Verification**:
   - Connection URIs enforce `sslmode=require`.
   - The private Aiven Project Root CA certificate resides locally at `infra/database/certs/aiven-ca.pem` (git-ignored) and in GitHub Secrets as `AIVEN_CA_CERT`.
   - Terraform (`var.aiven_ca_cert`), deployment scripts (`deploy.sh`, `terraform.sh`), and GitHub Actions (`ci.yml`, `cd.yml`, `drift.yml`) automatically inject `AIVEN_CA_CERT` into the Lambda runtime environments.
   - Backend connection pools strictly validate the certificate chain against this Root CA (`rejectUnauthorized: true, ca: process.env.AIVEN_CA_CERT`), eliminating Man-in-the-Middle (MITM) and DNS spoofing risks at $0.00 cost. If the CA cert is omitted, pools gracefully fall back to encrypted TLS (`rejectUnauthorized: false`).
2. **PostgreSQL Statement & Connection Timeouts**:
   - Client pools enforce `statement_timeout: 10000` (10 seconds) and `query_timeout: 10000` to prevent denial-of-service from runaway queries.
   - Connection pool limits are capped (`max: 1` per container, `idleTimeoutMillis: 30000`) to respect Aiven Free Tier connection bounds.
3. **Least-Privilege AI Database User**:
   - A dedicated read-only role (`cricscore_ai_reader`) is provided in `infra/database/migrations/create_read_only_ai_role.sql`.
   - Restricts AI queries strictly to `SELECT` and revokes `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, and DDL modifications.
4. **Parameterized Queries & Schema Isolation**:
   - 100% of SQL queries use `$1, $2, ...` parameter placeholders to neutralize SQL injection.
   - Separate PostgreSQL schemas (`dev` vs `prod`) isolate environments inside a single instance.

---

## 🛠️ Step-by-Step Provisioning

### Step 1: Create the Aiven PostgreSQL Service

| Setting            | Recommended Value                             |
| :----------------- | :-------------------------------------------- |
| **Console URL**    | [console.aiven.io](https://console.aiven.io/) |
| **Service Type**   | `PostgreSQL 16` (`pgvector` included)         |
| **Cloud & Region** | `AWS` (`us-east-1`, co-located with Lambdas)  |
| **Service Name**   | `cricscore-pg`                                |

### Step 2: Configure Local Environment (`.env.local`)

Copy the **Service URI** from the Aiven **Overview** tab and add it to `.env.local` in the repository root:

```bash
# Format: postgres://avnadmin:[PASSWORD]@[HOST]:[PORT]/defaultdb?sslmode=require
cat << 'EOF' >> .env.local
TF_DATABASE_URL='postgres://avnadmin:YOUR_PASSWORD@YOUR_HOST.aivencloud.com:PORT/defaultdb?sslmode=require'
EOF
```

### Step 3: Verify Connectivity & Run Migrations

```bash
# 1. Test connection and SSL handshake directly
PGCONNECT_TIMEOUT=10 psql "$TF_DATABASE_URL" -c "SELECT current_database(), version();"

# 2. Deploy infrastructure and apply SQL migrations to the dev schema
./infra/scripts/deploy.sh --env dev --use-local-env --migrate
```

### Step 4: Sync Secret to GitHub Actions (For CI/CD & Keep-Alive)

```bash
# Push TF_DATABASE_URL and environment variables to GitHub Actions
./infra/scripts/setup_github_envs.sh

# Or set the repository-level secret used by .github/workflows/keepalive.yml directly:
gh secret set TF_DATABASE_URL --body "$TF_DATABASE_URL"
```

---

## 🔍 Troubleshooting Keep-Alive & Connections

- **`keepalive.yml` fails after 3 tries:**
  - **Cause:** Free-tier service paused due to prior inactivity.
  - **Fix:** Log into [console.aiven.io](https://console.aiven.io/) and click **Power On / Start** on the PostgreSQL service.
- **`password authentication failed`:**
  - **Cause:** Aiven rotated database credentials.
  - **Fix:** Copy the updated Service URI from Aiven into `.env.local` and re-run `./infra/scripts/setup_github_envs.sh`.
- **`SSL/TLS required` error:**
  - **Cause:** Missing `?sslmode=require` query parameter.
  - **Fix:** Append `?sslmode=require` to `TF_DATABASE_URL` in `.env.local` and GitHub Secrets.

---

© 2026 CricScore Documentation. 🏎️🏁🚀
