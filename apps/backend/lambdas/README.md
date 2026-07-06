# ⚡ Lambdas — AWS Serverless Functions

All backend business logic runs as individual AWS Lambda functions. Each Lambda is fully self-contained with its own `package.json` and dependencies.

## Lambda Inventory

| Lambda           | Trigger               | Purpose                                                        |
| ---------------- | --------------------- | -------------------------------------------------------------- |
| `match-api`      | API Gateway REST      | CRUD for matches, innings, players; health check endpoint      |
| `score-update`   | API Gateway REST      | Validates and publishes ball events to SNS fan-out             |
| `storage-worker` | SQS Queue             | Reliably writes ball events to PostgreSQL with ACID guarantees |
| `broadcaster`    | SNS Topic             | Pushes live score updates to all connected WebSocket clients   |
| `onconnect`      | WebSocket $connect    | Registers fan connection ID in DynamoDB                        |
| `ondisconnect`   | WebSocket $disconnect | Removes stale connection from DynamoDB                         |
| `chat-api`       | API Gateway REST      | Agentic AI Chat — MCP + RAG pipeline (see below)               |

## 🤖 chat-api — Agentic AI Lambda

The most complex Lambda. Implements a full **Agentic RAG pipeline** using the [Model Context Protocol (MCP)](https://modelcontextprotocol.io).

### Architecture

```
chat-api/
├── index.js                      ← Thin Lambda router
├── config/
│   ├── db.js                     ← Shared PostgreSQL pool + setSearchPath()
│   └── llm.js                    ← OpenAI/OpenRouter client + model config
├── handlers/
│   ├── chatHandler.js            ← Main agentic chat loop (MCP client)
│   ├── summaryHandler.js         ← AI post-match summary generation
│   └── uploadRulesHandler.js     ← PDF ingestion + batch vector embedding
└── mcp/
    ├── server.js                 ← MCP Server — registers all tools
    └── tools/
        ├── executeSql.js         ← Text-to-SQL RAG (READ ONLY, 3s timeout)
        └── searchRules.js        ← Vector cosine-similarity RAG
```

### Routes

| Method | Path            | Handler                 | Description                            |
| ------ | --------------- | ----------------------- | -------------------------------------- |
| POST   | `/chat`         | `chatHandler.js`        | Agentic AI conversation                |
| POST   | `/chat/summary` | `summaryHandler.js`     | Generate AI match summary              |
| POST   | `/rules/upload` | `uploadRulesHandler.js` | Upload + embed tournament PDF rulebook |

### MCP Security Model

```
User Question
     │
     ▼
 LLM (OpenRouter)         ← Only sees: tool schemas + result text
     │ decides to call tool
     ▼
 MCP Server               ← Has: DATABASE_URL, LLM_API_KEY
     │ executes securely
     ▼
 PostgreSQL / pgvector    ← Returns: raw data
```

The LLM **never** receives credentials. All secrets are isolated inside the MCP Server.

## Local Development

```bash
# Install dependencies for all lambdas
for d in apps/backend/lambdas/*; do
  [ -f "$d/package.json" ] && (cd "$d" && npm install)
done

# Run backend unit tests
cd apps/backend && npm test
```

## Required Environment Variables (chat-api)

| Variable       | Description                             |
| -------------- | --------------------------------------- |
| `DATABASE_URL` | Aiven PostgreSQL connection string      |
| `DB_SCHEMA`    | `dev` or `prod` (injected by Terraform) |
| `LLM_API_KEY`  | OpenRouter API key                      |
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1`          |
| `LLM_MODEL`    | _(Optional)_ Override model name        |
