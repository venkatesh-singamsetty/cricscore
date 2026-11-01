# 🗄️ Aiven Managed PostgreSQL Setup Guide

CricScore uses **Aiven Managed PostgreSQL** (`pgvector` enabled) as its primary ACID relational and vector database. Both `dev` and `prod` environments share a single Aiven instance isolated by PostgreSQL schemas (`DB_SCHEMA=dev` and `DB_SCHEMA=prod`), pairing with the `~$1/month` AWS serverless footprint (`dev` + `prod` combined).

---

## 🏗️ Database Architecture & Keep-Alive Flow

```mermaid
flowchart TD
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

- **ACID Transactions:**
  - Guarantees strict ball-by-ball cricket scoring consistency and eliminates race conditions or lost deliveries.
- **Schema Isolation (`DB_SCHEMA=dev` / `DB_SCHEMA=prod`):**
  - Isolates `dev` and `prod` tables inside a single database instance, avoiding duplicate managed database fees.
- **`pgvector` Extension:**
  - Powers semantic rulebook RAG search (`match_chunks`) directly inside PostgreSQL without an external vector database.
- **Automated Keep-Alive (`.github/workflows/keepalive.yml`):**
  - Pings the database daily at 12:00 UTC (`SELECT 1 AS keep_alive;`) with 3x retry logic to prevent free-tier inactivity sleep.

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
