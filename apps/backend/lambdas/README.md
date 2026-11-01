# ⚡ AWS Lambda Packages (`apps/backend/lambdas/`)

Each subdirectory is an independent Node.js 24.x AWS Lambda package archived by Terraform (`data.archive_file`) during deployment.

---

## 📋 Function & Route Matrix

| Lambda Package          | Trigger / Routes                                                                                                                                                                        | Backing Stores & Services                                                                                      |
| :---------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| **`match-api`**         | • `GET/POST/DELETE /matches`<br/>• `POST /match`, `GET/PATCH/DELETE /match/{id}`<br/>• `GET /match/{id}/details`, `POST /match/{id}/innings`<br/>• `POST /match/{id}/email`, `/admin/*` | • Aiven PostgreSQL 16<br/>• Amazon SES & Amazon S3 (`backups/`)<br/>• Cognito Admin API & `broadcaster` Lambda |
| **`score-update`**      | • `POST /update-score`<br/>• `POST /match/{id}/score`                                                                                                                                   | • Amazon SNS (`match-events`)<br/>• Amazon SQS FIFO (`storage-buffer.fifo`)                                    |
| **`storage-worker`**    | • SQS FIFO trigger (`batch_size = 1`)                                                                                                                                                   | • Aiven PostgreSQL 16 (`matches`, `innings`, `players`, `bowlers`, `balls`)                                    |
| **`broadcaster`**       | • SNS subscription<br/>• Direct Lambda invoke                                                                                                                                           | • Amazon DynamoDB (`<project>-connections`)<br/>• API Gateway WebSocket `@connections`                         |
| **`onconnect`**         | • WebSocket `$connect`                                                                                                                                                                  | • Amazon DynamoDB (`<project>-connections`)                                                                    |
| **`ondisconnect`**      | • WebSocket `$disconnect`                                                                                                                                                               | • Amazon DynamoDB (`<project>-connections`)                                                                    |
| **`cognito-presignup`** | • Cognito `PreSignUp` trigger                                                                                                                                                           | • AWS Cognito User Pool                                                                                        |
| **`chat-api`**          | • `POST /chat`<br/>• `POST /chat/summary`<br/>• `GET/POST/DELETE /rules`                                                                                                                | • Aiven PostgreSQL 16 + `pgvector`<br/>• OpenAI API & Open-Meteo API<br/>• GitHub Issues REST API              |

---

## 🤖 `chat-api` Internal Structure

```mermaid
flowchart LR
    Req["POST /chat or /chat/summary"] --> Router["chat-api/index.js"]
    Router --> Chat["handlers/chatHandler.js (MCP Client)"]
    Router --> Sum["handlers/summaryHandler.js (Deterministic POTM)"]
    Router --> Rules["handlers/*RulesHandler.js (PDF -> pgvector)"]
    Chat --> MCP["mcp/server.js (InMemoryTransport)"]
    MCP --> T1["executeSql.js"] & T2["searchRules.js"] & T3["getMatchWeather.js"] & T4["createGithubIssue.js"]
```

| `chat-api` Environment Variable  | Purpose                                                                         |
| :------------------------------- | :------------------------------------------------------------------------------ |
| `DATABASE_URL`                   | Aiven PostgreSQL 16 connection URI (`sslmode=require`)                          |
| `DB_SCHEMA`                      | `dev` or `prod` schema isolation                                                |
| `OPENAI_API_KEY` / `LLM_API_KEY` | API key for `gpt-4o-mini` and `text-embedding-3-small`                          |
| `LLM_BASE_URL` / `LLM_MODEL`     | OpenAI-compatible base URL and model override                                   |
| `GITHUB_TOKEN`                   | Server-side token for `create_github_issue` (`venkatesh-singamsetty/cricscore`) |

---

## 🧪 Install & Test Commands

```bash
# Hydrate all Lambda node_modules
for d in apps/backend/lambdas/*; do
  [ -f "$d/package.json" ] && (cd "$d" && npm install)
done

# Run 121 backend unit tests
cd apps/backend && npm test
```
