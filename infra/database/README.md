# 🗄️ Database — PostgreSQL Schema

PostgreSQL schema definitions for CricScore. The same schema is shared across `dev` and `prod` environments using PostgreSQL **schemas** (namespaces) for isolation.

## Files

| File         | Purpose                                                |
| ------------ | ------------------------------------------------------ |
| `schema.sql` | Full DDL — creates all tables, extensions, and indexes |

## Applying the Schema

Run against your Aiven PostgreSQL instance:

```bash
psql "$DATABASE_URL" -f infra/database/schema.sql
```

> ⚠️ Run this **once** when setting up a new environment. Tables use `CREATE TABLE IF NOT EXISTS` so re-running is safe.

## Environment Isolation

CricScore uses PostgreSQL **schemas** (not separate databases) for environment isolation:

```sql
CREATE SCHEMA IF NOT EXISTS dev;
CREATE SCHEMA IF NOT EXISTS prod;
```

All Lambda queries prepend `SET search_path TO dev, public` (or `prod, public`) before executing — this ensures:

- `dev` tables are completely invisible from `prod` queries
- The `public` schema is always accessible so `pgvector` operators work

## Tables

### Core Match Tables

| Table         | Description                                          |
| ------------- | ---------------------------------------------------- |
| `matches`     | Match metadata: teams, scores, status, AI summary    |
| `innings`     | Per-inning data: batting/bowling team, runs, wickets |
| `players`     | Per-batter stats for each inning                     |
| `bowlers`     | Per-bowler stats for each inning                     |
| `ball_events` | Ball-by-ball delivery log (immutable audit trail)    |

### AI / Vector Tables

| Table              | Description                                                 |
| ------------------ | ----------------------------------------------------------- |
| `tournament_rules` | Chunked PDF text + `vector(1536)` embeddings for RAG search |

### Utility Tables

| Table         | Description                                     |
| ------------- | ----------------------------------------------- |
| `sent_emails` | Tracks which notification emails have been sent |

## Extensions

```sql
CREATE EXTENSION IF NOT EXISTS vector;  -- pgvector for AI embeddings
```

## Indexes

```sql
-- HNSW index for fast approximate nearest-neighbor vector search
CREATE INDEX IF NOT EXISTS tournament_rules_embedding_idx
ON tournament_rules
USING hnsw (embedding vector_cosine_ops);
```

The **HNSW** (Hierarchical Navigable Small World) index provides sub-millisecond cosine similarity search even with thousands of embedding vectors — at zero additional cost vs. a plain table scan at this scale.

## Important Notes for New Contributors

1. The schema must be applied **before** the AI features work
2. The `pgvector` extension must be enabled on the Aiven instance — it is supported out-of-the-box on Aiven PostgreSQL
3. After uploading a PDF via the UI, vectors are written to `tournament_rules` scoped to the current `DB_SCHEMA` — so **Dev and Prod each need their own PDF upload**
