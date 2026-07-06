# ⚙️ Config — Shared Lambda Configuration

Centralised configuration modules shared across all handlers and MCP tools in the `chat-api` Lambda.

## Files

### `db.js` — PostgreSQL Connection Pool

```js
const { pool, setSearchPath } = require("../config/db");
```

| Export          | Type       | Description                                              |
| --------------- | ---------- | -------------------------------------------------------- |
| `pool`          | `Pool`     | Shared `pg.Pool` — reused across warm Lambda invocations |
| `setSearchPath` | `Function` | Sets `search_path TO ${DB_SCHEMA}, public` on a client   |

**Why `setSearchPath` always appends `public`:**

The `pgvector` extension installs its `<=>` cosine similarity operator in the `public` schema. If we set `search_path TO dev` only, PostgreSQL can't find the operator and throws `operator does not exist`. By appending `public`, we get both:

- **Data isolation**: `SELECT * FROM matches` hits `dev.matches` or `prod.matches`
- **Operator availability**: `embedding <=> $1::public.vector` always resolves

### `llm.js` — LLM & Embedding Configuration

```js
const {
  openai,
  LLM_MODEL,
  EMBEDDING_BASE_URL,
  EMBEDDING_MODEL,
} = require("../config/llm");
```

| Export               | Type     | Description                                              |
| -------------------- | -------- | -------------------------------------------------------- |
| `openai`             | `OpenAI` | Pre-configured OpenAI SDK client (OpenRouter-compatible) |
| `LLM_MODEL`          | `string` | Active model — `gpt-4o-mini` or from `LLM_MODEL` env     |
| `EMBEDDING_BASE_URL` | `string` | Base URL for embedding API calls                         |
| `EMBEDDING_MODEL`    | `string` | `openai/text-embedding-3-small`                          |

**Why native `fetch` for embeddings (not the OpenAI SDK):**

The OpenAI Node.js SDK internally uses streaming and crashes with `ERR_STREAM_PREMATURE_CLOSE` when the endpoint is OpenRouter instead of OpenAI. We bypass this by calling the embedding API directly via native Node.js `fetch`, which has no streaming issues.

## Environment Variables

All configuration is driven by environment variables injected by Terraform at deploy time:

| Variable       | Used In  | Description                        |
| -------------- | -------- | ---------------------------------- |
| `DATABASE_URL` | `db.js`  | Aiven PostgreSQL connection string |
| `DB_SCHEMA`    | `db.js`  | `dev` or `prod`                    |
| `LLM_API_KEY`  | `llm.js` | OpenRouter API key                 |
| `LLM_BASE_URL` | `llm.js` | Provider base URL                  |
| `LLM_MODEL`    | `llm.js` | _(Optional)_ Model override        |
