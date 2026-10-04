# 🤖 AI Architecture: Agentic RAG (Text-to-SQL & Vector Search)

CricScore integrates an advanced **Agentic Retrieval-Augmented Generation (RAG)** system to provide an interactive **AI Chat Assistant** for fans.

Our chatbot is a fully autonomous AI Agent capable of two primary RAG methodologies:

1. **Text-to-SQL:** It answers questions about live matches, historical data, and player stats in real-time by autonomously writing and executing read-only SQL queries directly against the high-performance PostgreSQL event hub.
2. **Vector Semantic Search:** It answers rule-based questions (e.g. rain delays, tiebreakers) by embedding the query and performing a cosine-similarity search against a custom `pgvector` knowledge base built from uploaded PDF tournament rulebooks.

## 🏗️ Architecture

The AI Chat system is built as a serverless Lambda (`chat-api`) integrated with Amazon API Gateway, communicating directly with OpenAI using **OpenAI Tool Calling (Functions)**.

```mermaid
sequenceDiagram
    autonumber
    actor Viewer as Fan
    participant App as React Frontend (AI Tab)
    participant APIGW as API Gateway (/chat)
    participant ChatAPI as chat-api Lambda (MCP Client)
    participant MCPServer as MCP Server (In-Memory)
    participant LLM as Chat LLM (OpenAI gpt-4o-mini)
    participant EmbedLLM as Embedding LLM (text-embedding-3-small)
    participant Aiven_PG as Aiven PostgreSQL

    Viewer->>App: Sends Chat Message
    App->>APIGW: POST /chat { message, matchId }
    APIGW->>ChatAPI: Trigger Event

    rect rgb(200, 200, 200, 0.1)
        Note right of ChatAPI: MCP Initialization
        ChatAPI->>MCPServer: Spin up and connect (InMemoryTransport)
        ChatAPI->>MCPServer: List Available Tools
        MCPServer-->>ChatAPI: Returns Tool Schemas
    end

    rect rgb(0, 0, 0, 0.1)
        Note right of ChatAPI: Context Initialization
        ChatAPI->>Aiven_PG: Fetch Active Match Details (if matchId)
        Aiven_PG-->>ChatAPI: Returns Live Score Context
    end

    ChatAPI->>LLM: Send DB Schema + User Query + Tools Definition

    alt Needs Live Match/Historical Data
        rect rgb(50, 50, 150, 0.1)
            Note right of ChatAPI: 1. Text-to-SQL Routing
            LLM-->>ChatAPI: Generate Tool Call: `execute_sql`
            ChatAPI->>MCPServer: Delegate: Call `execute_sql` tool
            MCPServer->>Aiven_PG: BEGIN READ ONLY - Execute SQL
            Aiven_PG-->>MCPServer: Return Query Results
            MCPServer-->>ChatAPI: Return MCP Standard Response
            ChatAPI->>LLM: Return Tool Result
            LLM-->>ChatAPI: Generate Final SQL-based Answer
        end
    else Needs Rulebook Information
        rect rgb(0, 100, 0, 0.1)
            Note right of ChatAPI: 2. Vector RAG Routing
            LLM-->>ChatAPI: Generate Tool Call: `search_tournament_rules`
            ChatAPI->>MCPServer: Delegate: Call `search_tournament_rules`
            MCPServer->>EmbedLLM: Request Embedding (text-embedding-3-small)
            EmbedLLM-->>MCPServer: Return Vector (Embeddings)
            MCPServer->>Aiven_PG: SELECT chunk_text ORDER BY embedding <=> $1 LIMIT 3
            Aiven_PG-->>MCPServer: Return top 3 rule chunks
            MCPServer-->>ChatAPI: Return MCP Standard Response
            ChatAPI->>LLM: Return Tool Result
            LLM-->>ChatAPI: Generate Final Rule-based Answer
        end
    else Needs General Cricket Knowledge
        rect rgb(150, 50, 50, 0.1)
            Note right of ChatAPI: 3. Generic Info Routing (No Tools)
            LLM-->>ChatAPI: Determine no tools are needed
            LLM-->>ChatAPI: Generate Generic Answer from Internal Knowledge
        end
    end

    ChatAPI-->>APIGW: 200 OK { reply }
    APIGW-->>App: Display Response to Viewer
```

## 🌐 Model Context Protocol (MCP) Integration

CricScore natively implements the **Model Context Protocol (MCP)** to standardise and decouple its AI tooling.

To understand why it is designed this way, think of it like a **Manager (the LLM)** and an **Executive Assistant (the MCP Server)**:

- The LLM is very smart, but it has no hands. It cannot touch your database.
- The MCP Server is not smart, but it holds the keys to the database and can execute commands securely.

### The Exact Flow: Answering a Fan's Question

When a fan asks a question (e.g., _"Who scored the most runs today?"_), the following strictly separated execution occurs:

1. **The Question Arrives:** API Gateway triggers the `chat-api` Lambda.
2. **The MCP Client Checks Tools:** Inside the Lambda, the MCP Client asks the local MCP Server (also inside the Lambda): _"What tools do you have?"_ The server responds with schemas for tools like `execute_sql`.
3. **The LLM "Thinks" (External Call):** The MCP Client sends the question and the tool schemas across the internet to the OpenAI LLM (`gpt-4o-mini`). The LLM thinks: _"I don't know the answer, but I can use `execute_sql` to find out!"_ The LLM replies with a request to execute a specific SQL query.
4. **The MCP Server "Acts" (Local Execution):** The MCP Client receives this request and turns to the local MCP Server. The MCP Server uses its secret `DATABASE_URL`, connects to Aiven PostgreSQL, executes the query, and gets the JSON result.
5. **The LLM Answers:** The MCP Client sends the raw database JSON back to the LLM. The LLM reads it and generates a friendly, natural response (e.g., _"Virat was the top scorer with 85 runs!"_).
6. **The Response:** The final friendly answer is returned to the Fan.

**Why is this brilliant?** The LLM never connected to your database. Your `DATABASE_URL` password never left your AWS cloud. The LLM is strictly kept in a "sandbox" where it can only _request_ that actions be taken, while the MCP Server acts as the secure bouncer.

### Technical Implementation

Instead of tightly coupling database and vector logic directly into the LLM chat router loop, the `chat-api` Lambda operates using an **MCP Client-Server Architecture**:

1. **MCP Server (`mcpServer.js`):** A standalone module that defines the tools (`execute_sql`, `search_tournament_rules`) using the `@modelcontextprotocol/sdk`. It manages the database pooling and security parameters internally.
2. **MCP Client (`index.js`):** The main Lambda handler instantiates an MCP Client, connects to the MCP Server via `InMemoryTransport`, and dynamically lists the tools. When the LLM decides to call a tool, the client simply delegates the call via the standardized `client.callTool()` interface.

_Why use `InMemoryTransport`?_ Standard MCP typically runs over `stdio` or WebSockets/SSE for local IDE or distributed execution. By utilizing the `InMemoryTransport` within the Lambda, we achieve the perfect architectural decoupling and standardization of MCP without needing to provision expensive, long-running ECS/EC2 containers to host an SSE server!

### ⏳ The Serverless Execution Lifecycle

Because the MCP Client and Server run on AWS Lambda via `InMemoryTransport`, their execution speed is determined by the Serverless lifecycle:

1. **The "Cold Start" (The first question in a while)**
   If no questions have been asked for ~15 minutes, AWS terminates the container to save money. When a new question arrives, AWS spins up a new micro-container and boots Node.js. Because the MCP Client & Server are just JavaScript classes in memory, they initialize in just **~2 to 5 milliseconds**. The entire boot process takes roughly **500ms to 1 second** before sending the prompt to the LLM.

2. **The "Warm Start" (Subsequent questions)**
   If another question is asked shortly after, AWS reuses the "frozen" container. The Node.js environment, database connection pool, and **MCP Client/Server are already initialized and waiting in memory**. The boot time is **~0 milliseconds**, and the prompt is instantly routed to the LLM.

**How long does the MCP Server stay alive?**
It stays alive exactly as long as the Lambda container stays alive. Between questions, AWS freezes the container (you do not pay for frozen time). After roughly 15 to 45 minutes of complete inactivity, AWS destroys the container and the MCP Server with it, returning your AWS bill to $0.00.

## 📚 Vector RAG: Multi-Document PDF Tournament Rules

We have extended the PostgreSQL database with the `pgvector` extension to serve as a native Vector Database alongside our relational data. This completely removes the need for a third-party vector database (like Pinecone).

1. **Multi-Document PDF Processing (`/rules/upload`):** Admins can upload multiple distinct PDF rulebooks via the AI Chatbot (shown only when logged in as Admin). The `chat-api` Lambda receives the base64 encoded PDF along with the `fileName`, uses `pdf-parse` (v2) to extract text, and splits the text into chunks.
2. **Scoped Replacements:** If a document with the same `fileName` is uploaded, the backend first issues a scoped `DELETE FROM tournament_rules WHERE document_name = $1` to wipe the old chunks for that specific document before inserting the new ones.
3. **Batch Embedding Generation:** To prevent AWS API Gateway from timing out (30-second hard limit), the backend passes all chunks in a single batched array request to OpenAI's `text-embedding-3-small` model.
4. **Storage:** The chunks, their 1536-dimensional embeddings, and the `document_name` are stored in the `tournament_rules` table.
5. **Agentic Tool:** The LLM is provided the `search_tournament_rules` tool. If a user asks a rule-related question, the LLM calls this tool, and the backend performs a semantic vector search (`<=>`) against `pgvector` to return the 3 most relevant paragraphs to the LLM, including their source `document_name`.
6. **Explicit Citations:** The LLM is strictly instructed via its system prompt to explicitly cite `[Source: document_name]` in its final response, so users can trust exactly which rulebook the regulation came from.

## 🔑 LLM API Key Configuration & Provider Setup

The backend connects directly to **OpenAI** for high-precision inference and embedding generation:

- **Chat & Tool Calling Engine:** `gpt-4o-mini` (lightning-fast, structured reasoning, full tool-calling support)
- **Vector Embedding Engine:** `text-embedding-3-small` (1536-dimensional semantic vector embeddings for `pgvector`)

### ⚡ Why OpenAI Responses Are Superior (Model vs Settings Breakdown)

The AI Assistant produces accurate, well-formatted, and reliable answers due to a combination of model capabilities and RAG configuration tuning:

| Aspect                 | Optimization / Tuning                                  | Impact on Response Quality                                                                                                                            |
| :--------------------- | :----------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Model Choice**       | `gpt-4o-mini`                                          | Superior instruction-following, multi-step SQL synthesis, and strict adherence to rulebook parameters compared to legacy open-source models.          |
| **Paragraph Chunking** | ~1,000 char paragraph blocks (`uploadRulesHandler.js`) | Replaced arbitrary line-count cuts with double-newline paragraph boundaries, preventing split sentences and preserving context.                       |
| **pgvector Retrieval** | `LIMIT 8` chunks (`searchRules.js`)                    | Increased vector search limit from 3/6 to 8 chunks, feeding up to ~6,400 characters of exact rulebook context per query.                              |
| **Token Limit**        | `max_tokens: 2000` (`chatHandler.js`)                  | Prevents response truncation when formatting 10-match tables or complex multi-paragraph explanations.                                                 |
| **Temperature**        | `temperature: 0.1`                                     | Ensures deterministic, factual responses without creative hallucination on match stats or rulebook provisions.                                        |
| **Guardrail Rule 8**   | System Prompt Rule 8                                   | Explicitly instructs model: _"ALWAYS prefer the uploaded rulebook text as absolute truth over general knowledge"_ (e.g. Leg Byes counting as extras). |
| **Time Awareness**     | System Prompt Date Injection                           | Injects real-time `Date().toISOString()` to prevent the LLM from defaulting to its training cutoff year (e.g., assuming "August" means August 2023).  |
| **SQL Generation**     | System Prompt PostgreSQL Hints                         | Explicitly enforces strict `GROUP BY` rules and corrects common column hallucinations (e.g., `team_name` -> `batting_team_name`) for player stats.    |

---

### 🔑 How to Create an OpenAI API Key

1. Log in to [OpenAI Platform](https://platform.openai.com/).
2. Navigate to **API Keys** under your Account Dashboard.
3. Click **Create new secret key**, name it `CricScore-Prod` (or `CricScore-Dev`), and set permissions to **All**.
4. Copy the secret key starting with `sk-proj-...`.
5. Add the key to your `.env.local` file:
   ```bash
   LLM_API_KEY="sk-proj-..."
   LLM_BASE_URL="https://api.openai.com/v1"
   ```
6. In AWS SSM Parameter Store / GitHub Secrets, store `LLM_API_KEY` for CI/CD deployments.

---

### 💵 Cost Analysis & Query Economics

Operating CricScore with native OpenAI models is extremely cost-effective:

- **Input Token Cost (`gpt-4o-mini`)**: $0.15 per 1,000,000 tokens
- **Output Token Cost (`gpt-4o-mini`)**: $0.60 per 1,000,000 tokens
- **Embedding Cost (`text-embedding-3-small`)**: $0.02 per 1,000,000 tokens

#### Per-Query Breakdown:

- **Average Chat Query**: ~1,500 input tokens + ~300 output tokens = **~$0.0004 per chat query** (~2,500 queries per $1.00).
- **Rulebook Upload**: 20-page PDF (~15,000 tokens) = **~$0.0003 per document upload**.
- **$4.50 OpenAI Balance**: Provides approximately **~11,250 chat queries** or **~15,000 PDF document uploads**.

---

### 🧪 Demo Prompts Suite for Evaluation

Use the following curated prompts during live demos or automated regression testing:

1. **Rulebook Specific (Leg Byes & Extras)**:
   > _"If a batsman hits the ball onto their pad and takes a run, does it count as leg byes or batsman runs?"_
2. **Match Summary & High Scores**:
   > _"Which team scored the highest total in the tournament so far?"_
3. **Knockout Tiebreaker Rules**:
   > _"What happens if a semi-final match ends in a tie?"_
4. **List Matches Count**:
   > _"Show me all matches currently recorded in the database."_
5. **Bowler Limits & Overs**:
   > _"What is the maximum number of overs a single bowler can bowl in a 20-over match?"_
6. **Forfeits & Points Allocation**:

   > _"How many points does a team get if their opponent forfeits the match?"_

7. **Backend Logic (`apps/backend/lambdas/chat-api/summaryHandler.js`)**
   - The default model identifier (e.g., `gpt-4o-mini` or `llama-3.3-70b-versatile`) is hardcoded in the `generateSummary` fallback logic. Update it to match the model you wish to use on the new provider.

_(Note: You do not need to modify the Terraform files directly, as `variables.tf` expects these to be passed down dynamically)._

## ⚙️ How Agentic Text-to-SQL Works

Instead of using a Vector Database (which introduces sync latency), the CricScore RAG system operates directly on the relational data:

1. **Schema Injection:** The system prompt injected into the LLM includes a highly succinct schema representation of the `matches`, `innings`, `players`, `bowlers`, and `ball_events` tables.
2. **Tool Definition:** The LLM is provided with an `execute_sql` tool definition in the OpenAI API request.
3. **Autonomous Execution:** If the user asks an analytical question, the LLM generates a PostgreSQL query. The `chat-api` Lambda executes this query on the user's behalf.
4. **Security & Governance:**
   - **Read-Only:** All LLM-generated queries are strictly wrapped in a `BEGIN READ ONLY;` transaction to prevent data corruption or hallucinated `DROP TABLE` commands.
   - **Performance Protection:** A strict `statement_timeout = 3000` is enforced at the transaction level to prevent the LLM from generating wildly complex joins that could bottleneck the database.
   - **Schema Isolation:** The `chat-api` Lambda dynamically sets the PostgreSQL `search_path` (e.g., `SET search_path TO dev;`) before executing any queries. This ensures that the Agentic AI only has access to the exact schema for the environment it is deployed in, preventing cross-environment data leakage.
   - **Guest Restrictions:** The system distinguishes between authenticated users and guests using Cognito tokens (`isGuest` flag). Guest users are restricted from invoking the LLM via the `/chat` endpoint (returning a graceful refusal) to protect against unrestricted API usage costs.

### Database Connection Notes

When connecting the Node.js `pg` client to the Aiven PostgreSQL database, the connection string (`DATABASE_URL`) provided by Terraform includes `?sslmode=require`. To prevent `self-signed certificate in certificate chain` errors, the Lambda explicitly strips this query parameter and configures the connection pool with `ssl: { rejectUnauthorized: false }`.

---

## 📊 AI Post-Match Summary (`summaryHandler.js`)

After a match concludes, the scorer can trigger an **AI-generated post-match report** via the Chat interface. The summary is generated once and then cached in the `matches.ai_summary` column for all subsequent requests.

### How It Works

For authenticated matches, the summary is generated by querying the OpenAI compatible endpoint. For matches prefixed with `guest_` (created by unauthenticated users), the AI Summary is NOT generated via the LLM API to prevent abuse. Instead, a local fallback summary is deterministically generated on the backend and returned immediately without consuming LLM credits.

```mermaid
sequenceDiagram
    actor Scorer
    participant Frontend as React Frontend
    participant APIGW as API Gateway (/chat/summary)
    participant SummaryHandler as summaryHandler.js
    participant DB as Aiven PostgreSQL
    participant LLM as OpenAI

    Scorer->>Frontend: Click "Generate AI Report"
    Frontend->>APIGW: POST /chat/summary { matchId }
    APIGW->>SummaryHandler: Trigger

    SummaryHandler->>DB: SELECT * FROM matches WHERE id = $1
    DB-->>SummaryHandler: Match row (scores, toss_winner, toss_decision, ai_summary)

    alt Cached summary exists
        SummaryHandler-->>Frontend: Return cached ai_summary
    else Generate fresh
        SummaryHandler->>DB: SELECT batters (top 5 by runs)
        SummaryHandler->>DB: SELECT bowlers (top 5 by wickets)
        SummaryHandler->>DB: COUNT legal ball_events per innings
        SummaryHandler->>LLM: Send factual match prompt
        LLM-->>SummaryHandler: Return summary text
        SummaryHandler->>DB: UPDATE matches SET ai_summary = $1
        SummaryHandler-->>Frontend: Return summary
    end
```

### Data Sources

The summary prompt is built from **database facts only** — no estimation or model inference:

| Data Point               | Source                                                          |
| ------------------------ | --------------------------------------------------------------- |
| Match result & winner    | `matches.match_winner`, `matches.status`                        |
| Team scores & wickets    | `matches.team_a_score`, `team_b_score`, etc.                    |
| Toss winner & decision   | `matches.toss_winner`, `matches.toss_decision`                  |
| Overs bowled per innings | `COUNT(ball_events)` where extra_type NOT IN ('WIDE','NO_BALL') |
| Top batters              | `players` JOIN `innings` — sorted by runs DESC                  |
| Top bowlers              | `bowlers` JOIN `innings` — sorted by wickets DESC               |

### Overs Calculation Strategy

Rather than using the stored `team_a_overs`/`team_b_overs` decimal fields (which can be stale when a match ends mid-over), the handler counts actual legal `ball_events` per innings:

```js
// Total legal balls → plain English using floor division
const completedOvers = Math.floor(totalLegalBalls / 6);
const remainder = totalLegalBalls % 6;
// → "1 over", "5 balls", "1 over and 2 balls" etc.
```

This guarantees accuracy even when the match ended on ball 6 (which would otherwise read as `0.5` in the decimal field).

### Prompt Engineering

The LLM receives a tightly-scoped, factual prompt:

- Overs are pre-computed to plain English **before** the prompt — no decimals are ever passed to the model.
- The toss winner/decision is injected verbatim from the DB as a concrete instruction.
- The model is told: _"Overs are already pre-calculated in plain English for you below. Use them exactly as written."_
- Creativity is intentionally constrained: _"Do not be overly creative or dramatic. Keep it straightforward."_

### Caching

Once generated, the summary is cached in `matches.ai_summary`. Subsequent requests return the cached value instantly without calling the LLM again. Admins can clear the cache by setting `ai_summary = NULL` in the DB (or a future admin API endpoint).

---

## 🛠️ Agentic Text-to-SQL Gotchas & Fixes

While building the Agentic SQL RAG, we encountered and resolved several common hallucination/execution issues:

1. **Schema Environment Fallback Issue:**
   - **Bug:** The Lambda relied on `process.env.DB_SCHEMA` to set the `search_path`. Since Terraform wasn't passing this variable, the AI kept querying the empty `public` schema instead of `dev`, falsely reporting 0 results.
   - **Fix:** Added `DB_SCHEMA = var.environment` to the `chat_api` Lambda's environment variables in Terraform.

2. **Over-Strict Context Refusal:**
   - **Bug:** The system prompt originally said "You can answer questions about the active match...". Because `matchContext` was sometimes empty (e.g., when chatting from the main dashboard), the LLM assumed it wasn't allowed to answer generic queries and refused to run SQL tools.
   - **Fix:** Explicitly commanded the LLM: `"Do not refuse to answer if there is no 'Active Match Context'. Just query the database!"`

3. **Case Sensitivity SQL Hallucination:**
   - **Bug:** The LLM successfully executed SQL but guessed lowercase enum strings (e.g., `WHERE status = 'completed'`). PostgreSQL strings are case-sensitive, so this returned 0 rows.
   - **Fix:** Injected explicit `Database Hints` into the system prompt:
     - Notified the LLM that `status` uses `UPPERCASE` values.
     - Mandated the use of `ILIKE` for all other case-insensitive string matching.

4. **Timezone (UTC) Hallucination:**
   - **Bug:** When asked "how many matches were played today?", the LLM ran `CURRENT_DATE = CAST(created_at AS DATE)`. Because the PostgreSQL server runs in UTC, "today" for the server had already rolled over to the next day, causing it to return 0 matches.
   - **Fix:** Added a hint telling the LLM to query using an interval for "today" (e.g. `created_at >= NOW() - INTERVAL '24 hours'`).

5. **Off-Topic Abuse (Guardrails):**
   - **Bug:** The LLM was willing to answer non-cricket questions (e.g. "generate code for adding 2 numbers in python"), which wastes API tokens on irrelevant requests.
   - **Fix:** Implemented strict persona boundaries in the system prompt. The AI is explicitly instructed to act strictly as a CricScore AI and refuse any prompts unrelated to cricket, matches, or sports statistics.

6. **Lambda & LLM API Timeouts:**
   - **Bug:** When executing complex tool chains, the `chat_api` Lambda repeatedly crashed with `Error: undefined`. CloudWatch logs revealed it was hitting the default 3-second AWS Lambda timeout, and sometimes hanging indefinitely due to Groq's API server stability issues/rate limits for the `llama-3.3-70b-versatile` model.
   - **Fix:**
     - Increased the AWS Lambda timeout to `30` seconds in Terraform (`infra/terraform/lambda.tf`).
     - Swapped the default LLM provider from Groq to native OpenAI in deployment scripts (`./infra/scripts/deploy.sh --env dev`), defaulting to `gpt-4o-mini` for lightning-fast and reliable responses that bypass the timeouts.

7. **Vector RAG - PDF-Parse Canvas Crash:**
   - **Bug:** Deploying `pdf-parse` inside the Lambda environment crashed instantly during initialization with `ReferenceError: DOMMatrix is not defined`. This is due to the underlying `pdf.js` library attempting to use browser-specific canvas APIs on modern Node.js environments without native canvas bindings.
   - **Fix:** Polyfilled the missing APIs globally (`global.DOMMatrix`, `global.ImageData`, `global.Path2D`) at the very top of the Lambda handler before the require statement.

8. **Vector RAG - API Gateway 30s Timeout Limit:**
   - **Bug:** When uploading a large PDF, iterating over 50+ chunks and making sequential requests to OpenAI to generate vector embeddings caused the Lambda to exceed API Gateway's unchangeable 30-second maximum integration timeout, leading to an immediate `503 Service Unavailable` for the client.
   - **Fix:** Refactored the embedding pipeline to collect all valid chunks into an array and send a single batched request to `openai.embeddings.create({ input: chunkArray })`. This brought processing time for a 10-page document down from 45+ seconds to under 3 seconds!

9. **Vector RAG - Embedding Generation Crash:**
   - **Bug:** Even with batch embeddings, the Lambda timed out at exactly 30 seconds without generating vectors. Testing revealed an underlying streaming issue, causing the server to silently hang.
   - **Fix:** Ripped out the OpenAI SDK dependency for generating the vector embeddings and replaced it with a 100% native Node.js `fetch` request, directly bypassing the bugged SDK library.

10. **Vector RAG - Lambda Out of Memory (OOM) Timeout:**

- **Bug:** The Lambda function was still randomly timing out at exactly 30 seconds when uploading larger PDFs. CloudWatch logs showed `Max Memory Used: 127 MB | Memory Size: 128 MB`. The `pdf-parse` library loads the entire PDF into memory; when it hit the default 128MB ceiling, V8's garbage collector aggressively thrashed to keep the function alive. This slowed down parsing to an absolute crawl, inevitably hitting the 30-second timeout limit.
- **Fix:** Increased the Lambda memory allocation in `lambda.tf` from `128 MB` to `1024 MB`. Because AWS bills on duration (GB-seconds) and 1024MB parses the PDF in just 2 seconds (compared to 128MB thrashing for 30 seconds), it is incredibly fast and completely free due to the generous AWS Free Tier limits (400,000 GB-seconds/month). This upgrade allowed the Lambda to instantly chunk and embed over 230+ rules sections seamlessly in a single execution!

11. **MCP - OpenAI Strict Schema Rejection:**

- **Bug:** When trying to pass the MCP tools (`client.listTools()`) directly into the OpenAI LLM `tools` parameter, the API violently rejected the request with a `400 Bad Request`.
- **Fix:** The MCP SDK standardizes inputs using JSON Schema Draft-07, automatically injecting `"$schema": "http://json-schema.org/draft-07/schema#"` into the tool definitions. However, OpenAI's API strictly prohibits additional root properties outside of standard OpenAPI types. To fix this, we map over the MCP tools and explicitly execute `delete toolDef.inputSchema.$schema` before passing them to the LLM.

12. **Vector RAG - pgvector `<=>` Operator Not Found:**

- **Bug:** After successfully routing to the `search_tournament_rules` MCP tool and generating an embedding, the vector similarity query failed with `operator does not exist: public.vector <=> public.vector`. The `pgvector` extension registers its `<=>` cosine operator inside the `public` schema. However, the MCP Server was executing `SET search_path TO dev` (or `prod`), which **removes `public` from the path entirely**. PostgreSQL found the `vector` type but could not locate its operators.
- **Fix:** Changed the `SET search_path` query to always include `public` as a fallback: `SET search_path TO ${dbSchema}, public`. This preserves strict data isolation (queries land in `dev` or `prod`) while keeping all pgvector extension operators globally visible. This single-line fix works for both environments dynamically via the `DB_SCHEMA` env variable injected by Terraform.

13. **LLM Answering from General Knowledge Instead of Rulebook:**

- **Bug:** When users asked vague rules questions like "break timings?" without explicitly saying "in my rulebook", the LLM skipped the `search_tournament_rules` tool entirely and answered from its general cricket training data, giving generic ICC rules instead of tournament-specific ones.
- **Fix (1) - Stronger System Prompt:** Updated the routing instruction to a strict mandate: _"NEVER answer a rulebook-type question from memory. Always search first, then answer based on the retrieved chunks. The rulebook has tournament-specific rules that override general cricket knowledge."_
- **Fix (2) - DB_SCHEMA Escaping Bug:** The database schema was being sent to the LLM as a literal `${DB_SCHEMA}` string (due to a `\\$` escape in a JavaScript template literal) instead of the actual table definitions. Fixed by removing the erroneous backslash escape.

14. **AI Post-Match Summary — Toss Outcome Hallucination:**

- **Bug:** The AI summary invented or assumed the toss result (e.g., "Team A won the toss and elected to bat") even when Team B actually won the toss and bowled. This happened because the original match creation used a single `batFirstTeam` field — the AI had no factual toss data and guessed based on batting order.
- **Fix:** Added `toss_winner` and `toss_decision` columns to the `matches` table. The Match Setup screen now collects these explicitly. The `summaryHandler.js` reads them from the DB and injects them verbatim into the prompt: _"Mention the toss details: [TEAM X] won the toss and elected to [BAT/BOWL]."_

15. **AI Post-Match Summary — Decimal Over Notation ("0.5 overs", "1.1 overs"):**

- **Bug:** The AI wrote "Team B chased in 0.5 overs" instead of "5 balls". The original `formatOvers()` helper produced strings like `"0.5 overs (0 completed overs and 5 balls)"`. The LLM latched onto the decimal prefix and used it verbatim, ignoring the parenthetical description.
- **Fix:** Replaced `formatOvers()` with `ballsToOversText()` which emits **only** plain English from a raw ball count — no decimals at all. The prompt was updated from _"Always write out overs in plain English"_ to _"Overs are already pre-calculated in plain English for you below. Use them exactly as written."_ This completely removes any ambiguity.

16. **AI Post-Match Summary — "5 Balls" Shown for a Complete 1-Over Innings:**

- **Bug:** A team that chased the target on ball 6 (completing exactly 1 over) was shown as having batted "5 balls" in the summary. The root cause was a race condition in the scoring engine: when the match-winning ball is recorded, the match immediately moves to `COMPLETED` state — but the over-flip transition (`overs=0.5 → overs=1.0`) runs on the _next_ state tick, which never fires. As a result, `matches.team_b_overs` was persisted as `0.5`.
- **Fix:** `summaryHandler.js` no longer reads the stored `team_a_overs`/`team_b_overs` decimal fields for the AI summary. Instead, it runs a fresh query to `COUNT` the actual legal `ball_events` per innings (`extra_type NOT IN ('WIDE','NO_BALL')`), then converts the total to overs using floor division. This is always correct, regardless of whether the over counter was finalized at match end.

17. **AI Database Context Truncation:**

- **Bug:** The AI could only "see" and analyze the 4 most recent matches, even if there were 10+ in the database. When users asked for "all matches", it would claim there were only 4.
- **Fix:** The `executeSql.js` MCP tool was previously stringifying the database JSON results and strictly truncating them at 2,000 characters to prevent prompt bloat. Increased the truncation limit to 25,000 characters, allowing the LLM to ingest much larger datasets for historical queries.

18. **AI Summary Race Condition ("1 run" Hallucination):**

- **Bug:** When a match ended with a boundary (e.g. hitting 6 runs to win), the AI summary immediately generated and confidently stated the team "finished at 1 run". The frontend was triggering the summary generation API instantly upon UI completion, but the final ball's payload was still sitting in the backend's SQS processing queue. Thus, the database query inside the summary handler was reading the pre-final-ball state.
- **Fix:** Added a `setTimeout` of 2.5 seconds in the frontend before dispatching the `/chat/summary` request. This small buffer ensures the background SQS workers have ample time to flush the final ball and update the `innings.total_runs` prior to the AI inspecting the scorecard.

---

## 🧠 Educational Context: Mapping AI Buzzwords to CricScore

This architecture seamlessly combines several advanced AI concepts. Here is a breakdown of what these terms actually mean in the context of this specific CricScore application:

### 1. AI (Artificial Intelligence)

The broad concept of computers mimicking human understanding.
**In CricScore:** The overall Chat feature where a fan can type a natural language question (e.g., "Who won the match yesterday?") and receive an intelligent, contextual answer instead of navigating through rigid menus or clicking buttons.

### 2. GenAI (Generative AI)

A subset of AI that focuses on creating novel content (text, images, code) rather than just classifying or predicting.
**In CricScore:** Instead of returning pre-programmed string templates (like `"Player X scored Y runs"`), the `chat-api` Lambda sends the data to an LLM (via OpenAI) which **generates** a completely unique, conversational, and context-aware response perfectly tailored to the user's specific phrasing.

### 3. RAG (Retrieval-Augmented Generation)

A technique where the AI system retrieves factual, external data from a database and injects it into the LLM's prompt so it can generate answers based on truth rather than hallucinating from its training data.
**In CricScore:** We implement two types of RAG:

- **Structured RAG (Text-to-SQL):** Retrieving live match scores and historical statistics from PostgreSQL.
- **Unstructured RAG (Vector Search):** Retrieving semantic chunks of the uploaded PDF Tournament Rulebook via `pgvector`.

### 4. Agentic AI

Systems where the LLM is given autonomous decision-making capabilities and access to "tools," allowing it to dynamically decide _how_ to solve a problem rather than just answering a static prompt.
**In CricScore:** The LLM acts as an Agent. When asked a question, it autonomously routes the request: it decides whether it needs to call the `execute_sql` tool for score data, the `search_tournament_rules` tool for PDF data, or no tools at all for general cricket knowledge.

### 5. MCP (Model Context Protocol)

An open standard that standardizes how AI models securely connect to and use external tools and data sources, separating the AI "brain" from the actual execution of the code.
**In CricScore:** We use an MCP Server (`mcpServer.js`) to securely encapsulate our database credentials (`DATABASE_URL`) and the tool execution code. The LLM acts as the MCP Client, receiving the schemas but never seeing the actual database passwords. This enforces a strict security boundary and makes the tools highly reusable!

---

## 💰 Cost & Infrastructure Scaling

This AI architecture is specifically designed to be **Serverless** and **Pay-Per-Use**, making it incredibly cheap (often entirely free) for local development and small-to-medium tournaments.

### AWS Lambda & API Gateway

- **Compute (AWS Free Tier):** AWS provides **400,000 GB-seconds** of compute time for free every month.
- **Memory Scaling vs Cost:** The `chat-api` Lambda is configured with **1024 MB** of RAM. This provides the memory overhead necessary to quickly parse large PDF files (via `pdf-parse`) in just ~2 seconds. Because AWS bills on duration multiplied by memory, running a 1024 MB function for 2 seconds (2.0 GB-s) is actually **cheaper** than running a 128 MB function that thrashes its garbage collector for 30 seconds (3.8 GB-s) before timing out!
- **MCP Infrastructure:** By utilizing the `@modelcontextprotocol/sdk`'s `InMemoryTransport`, the MCP Server boots instantly inside the Lambda execution environment. This completely avoids the need to provision expensive, always-on EC2 instances or ECS/Fargate containers to host WebSocket/SSE connections.

### Vector Database (`pgvector`)

- **Zero Extra Cost:** Instead of paying a premium monthly subscription for a dedicated Vector Database like Pinecone or Weaviate, we utilize the open-source `pgvector` extension directly within our existing Aiven PostgreSQL instance. The `HNSW` index ensures similarity searches remain lightning-fast without incurring any additional infrastructure fees.

### LLM Providers (OpenAI)

- **Model Choice:** By using native OpenAI, we gain maximum stability and access to the latest capabilities. Models like `gpt-4o-mini` provide exceptional function-calling accuracy at a fraction of a cent per request.
- **Embeddings:** Vector embeddings are generated using `text-embedding-3-small`, which is remarkably cheap and highly performant for semantic rulebook search.

---

## 🔐 Admin Tools

The Admin features have been securely integrated into the authenticated layout.

### Admin Access

Administrators log in via the Cognito Hosted UI. Once logged in as a designated admin, they can click the **Settings (⚙️)** icon in the navigation bar to access the Admin Panel, which provides tools for managing matches, users, and bulk database cleanups.

### Admin-Only MCP Tools

Once authenticated as admin, the MCP Server exposes **additional tools** that are hidden from regular users:

| Tool             | Description                                                             |
| ---------------- | ----------------------------------------------------------------------- |
| `delete_match`   | Delete a **single**, **multiple**, or **ALL** matches from the database |
| `send_email`     | Send a custom HTML email to one or more recipients via AWS SES          |
| Upload PDF Rules | The upload button becomes visible in the chatbot header for admins      |
| Manage Documents | A "Docs" dropdown allows admins to list and delete specific rulebooks   |

#### `delete_match` Usage Examples

Ask the chatbot naturally:

- _"Delete match `abc-123`"_ → deletes one match by ID
- _"Delete matches `abc-123` and `def-456`"_ → deletes two matches
- _"Delete all matches"_ → wipes all matches from the database

The tool internally handles all three cases:

```js
// Single ID
DELETE FROM matches WHERE id = $1

// Multiple IDs
DELETE FROM matches WHERE id IN ($1, $2, ...)

// All
DELETE FROM matches RETURNING id
```

### Toss Details in Match Creation

Match setup now captures full toss information:

- **Toss Winner**: Which team won the coin toss
- **Toss Decision**: Whether they chose to bat or bowl

These fields are persisted to the `matches` table (`toss_winner`, `toss_decision` columns) and included in the AI post-match summary automatically.

### Player of the Match (POM) Extraction

The AI post-match summary prompt explicitly commands the model to identify the "Player of the Match" based on the statistics provided.
To ensure this data is programmatically accessible:

1. The LLM is instructed to respond with `response_format: { type: "json_object" }`.
2. It returns a JSON object containing `{"summary": "...", "playerOfTheMatch": "..."}`.
3. The `chat-api` backend parses this JSON, saves the summary to `matches.ai_summary`, and explicitly stores the extracted name to `matches.player_of_the_match`.
4. This allows the Player of the Match to be prominently rendered in the Scoreboard UI and automated SES emails independently from the summary paragraph.

### Game-Changing Moments Analysis

The post-match summary prompt has been expanded with explicit instructions to generate a dedicated section on "Game-Changing Moments". To prevent AI hallucination, the model is strictly constrained to base this analysis **only** on the provided top batting and bowling statistics, preventing it from inventing imaginary wickets or boundary counts.

## 🎨 AI Chat UX & Client Features

The frontend `ChatComponent` is designed for a premium user experience and seamless interaction:

- **Persistent Memory**: The chat history is synchronized to `localStorage` (`cricscore-chat-memory`). This ensures that if a fan navigates away or refreshes the page, their ongoing context and conversation history are completely preserved.
- **New Chat Initialization**: A dedicated `[+] New Chat` button allows users to wipe the local memory instantly and start a fresh context with the LLM.
- **Copy Functionality**: Every response generated by the AI includes a quick-copy clipboard button, allowing fans to easily extract insights, statistics, and game summaries.
- **Premium Aesthetics**: The interface utilizes modern glassmorphism (`backdrop-blur-sm`), tailored indigo gradients, and constrained viewport scrolling (`min-h-0`) so that only the conversation scrolls, keeping the interface stable and usable regardless of chat length.
- **Voice Response System (TTS)**: The system integrates Web Speech API for Text-to-Speech responses. To overcome modern browser restrictions against asynchronous audio playback (especially on mobile and Safari), the UI triggers a silent "unlocking" utterance immediately upon user interaction (clicking "Voice On" or submitting the form), which primes the audio context and allows the AI's delayed response to be spoken aloud seamlessly.

---

## 🚀 Zero-Cost MLOps Pipeline (Live Win Predictor)

We have implemented a live **Match Win Predictor** (similar to WASP) that calculates real-time win probabilities after every ball. This system is architected to run entirely within the **AWS Free Tier**.

### Architecture Overview

1. **Model Storage (AWS ECR)**: The trained ML model (Logistic Regression) and its heavy dependencies (Pandas, Scikit-Learn) are packaged into a Docker container. AWS ECR provides 500MB of free private storage per month.
2. **Inference Engine (AWS Lambda - Container Image)**: A dedicated `ml-engine` Serverless Lambda runs the Docker image to expose a prediction API. Because Lambda scales to zero, there is zero cost when no matches are playing. AWS charges the exact same price for Container Image Lambdas as standard Zip Lambdas, allowing us to bypass the 250MB Zip limit while retaining the 1,000,000 free requests per month.
3. **Automated Pipeline**: A Terraform `null_resource` handles the `docker build` and `docker push` lifecycle seamlessly during deployment.
4. **Monorepo Integration**: The model code, Dockerfile, and inference API live in `apps/ml-engine/` inside the existing CricScore monorepo, keeping the data science and backend engineering perfectly synchronized.

- 📖 **[Win Prediction Engine Specification](./mlops_win_prediction_spec.md)**: Detailed mathematical models, par-RPO scaling equations, RRR caps, 50-50 match start baselines, and wicket sensitivity analysis.
- 📖 **[Duckworth-Lewis-Stern (DLS) Specification](./mlops_dls_spec.md)**: ICC exponential resource decay formulas, resource tables, DLS par-score calculations, and rain interruption tiebreakers.

### Edge Case Handling & Heuristics

1. **Dynamic Team Alignment**: The frontend `AiMatchPrediction.tsx` passes `battingTeam` as `team1` and `bowlingTeam` as `team2` so the model always receives the active batting team as the primary target class.
2. **Shortened Match Scale Normalization**: For shortened matches (e.g., 1-over matches), raw inputs of `balls_left = 5` and `current_score = 6` at ball 0.1 would trick a linear model into thinking the match is in the 20th over. `predict.py` normalizes `balls_left` and `current_score` by a factor of `(120 / total_match_balls)` during the 1st innings to evaluate probabilities on a 120-ball T20 equivalent scale.
3. **Start-of-Match Baseline (50% / 50%)**: At the start of the 1st innings (`currentScore = 0`, `wicketsLost = 0`), the model forces a 50% / 50% baseline probability before the first ball is bowled.
4. **Impossible Chase Override**: During the 2nd innings, if the required runs exceed the maximum possible runs (`runsNeeded > ballsLeft * 6`), the frontend and backend cap win probabilities to 0% for the chasing team and 100% for the defending team.
