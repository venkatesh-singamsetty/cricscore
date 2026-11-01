# 🗄️ Aiven Managed PostgreSQL Setup Guide

CricScore uses **Aiven Managed PostgreSQL** (`pgvector` enabled) as its primary ACID relational and vector database. Both `dev` and `prod` environments share a single Aiven instance isolated by PostgreSQL schemas (`DB_SCHEMA=dev` and `DB_SCHEMA=prod`), pairing with the `~$1/month` AWS serverless footprint (Dev + Prod combined).

---

## 🏗️ Database Architecture & Keep-Alive Flow

```mermaid
flowchart LR
    subgraph GitHub["GitHub Actions (Daily Cron)"]
        KA["keepalive.yml\n(12:00 UTC Daily)"]
    end

    subgraph AWS["AWS Serverless (~$1/mo Dev + Prod)"]
        DevL["Dev Lambdas\n(DB_SCHEMA=dev)"]
        ProdL["Prod Lambdas\n(DB_SCHEMA=prod)"]
    end

    subgraph Aiven["Aiven PostgreSQL (SSL Required)"]
        PG[("defaultdb\n├─ schema: dev\n├─ schema: prod\n└─ ext: vector")]
    end

    KA -->|"SELECT 1 AS keep_alive"| PG
    DevL -->|"SSL Connection Pool"| PG
    ProdL -->|"SSL Connection Pool"| PG
```

---

## 📋 Why Aiven PostgreSQL?

| Capability               | Engineering Benefit                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **ACID Transactions**    | Guarantees strict ball-by-ball cricket scoring consistency without race conditions or lost deliveries.                |
| **Schema Isolation**     | Isolates `dev` and `prod` tables inside a single database instance via `DB_SCHEMA`, avoiding duplicate instance fees. |
| **pgvector Extension**   | Powers semantic rulebook search (`match_chunks`) directly inside PostgreSQL without an external vector database.      |
| **Automated Keep-Alive** | `.github/workflows/keepalive.yml` pings the database daily (`SELECT 1`) with 3x retry logic to prevent sleep pauses.  |

---

## 🛠️ Step-by-Step Provisioning

### Step 1: Create the Aiven PostgreSQL Service

| Setting            | Recommended Value                             | Notes                                                           |
| ------------------ | --------------------------------------------- | --------------------------------------------------------------- |
| **Console URL**    | [console.aiven.io](https://console.aiven.io/) | Sign up or log in to your Aiven account                         |
| **Service Type**   | `PostgreSQL`                                  | Latest supported version with `pgvector` support                |
| **Cloud & Region** | `AWS` / `us-east-1`                           | Co-locates database with CricScore AWS Lambdas for low latency  |
| **Service Name**   | `cricscore-pg`                                | Copy the **Service URI** from the **Overview** tab once running |

### Step 2: Configure Local Environment (`.env.local`)

Add your Aiven Service URI to `.env.local` in the repository root:

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

| Symptom                             | Root Cause                                 | Fix Command / Action                                                                  |
| ----------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `keepalive.yml` fails after 3 tries | Free-tier service paused due to inactivity | Log into [console.aiven.io](https://console.aiven.io/) and click **Power On / Start** |
| `password authentication failed`    | Aiven rotated credentials                  | Copy the updated Service URI and re-run `./infra/scripts/setup_github_envs.sh`        |
| `SSL/TLS required` error            | Missing `?sslmode=require` query parameter | Append `?sslmode=require` to `TF_DATABASE_URL`                                        |

---

© 2026 CricScore Documentation. 🏎️🏁🚀
