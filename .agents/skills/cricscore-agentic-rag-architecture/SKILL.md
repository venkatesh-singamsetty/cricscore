---
name: cricscore-agentic-rag-architecture
description: Use when changing CricScore chat, LLM provider configuration, MCP tools, SQL or vector retrieval, rulebook ingestion, or AI summaries.
---

# CricScore Agentic RAG, Python AI Service & MCP Architecture

Use `docs/ai_architecture.md`, `docs/github_issue_agent.md`, `docs/weather_report_agent.md`, `apps/ai-service/` (Python LangGraph & MCP), `apps/backend/lambdas/chat-api/` (Node.js Adapter), and `apps/frontend/src/components/ChatComponent.tsx` as the source of truth.

## 1. Multi-Agent Python AI Service (`apps/ai-service`) & Node.js MCP Server (`chat-api`)

- **LangGraph Supervisor & Specialist Agents (`cricscore_ai/` & `chat-api/mcp/`)**:
  - `graph.py` / `router.py` / `chatHandler.js`: Classifies user intent and routes between specialist nodes and MCP tools:
    - **Match Info & SQL Agent (`execute_sql`)**: Parameterized and validated read-only SQL queries against PostgreSQL.
    - **Cricket RAG Agent (`search_tournament_rules`)**: `pgvector` similarity search on official tournament rulebooks (`rule_chunks`).
    - **Cricket Analysis Agent**: Synthesizes live match statistics and game progression analysis.
    - **Prediction Agent (`predict_match_outcome`)**: Live win probability and par calculation integration.
    - **Weather Report Agent (`get_match_weather`)**: Zero-cost ($0) live ("next few hours") and upcoming/tomorrow's match weather forecasts + DLS rain advisories via Open-Meteo (`geocoding-api.open-meteo.com` & `api.open-meteo.com`, no API key required). Asks the user for their city/ground first if no location is provided (`docs/weather_report_agent.md`).
    - **GitHub Issue Specialist Agent (`create_github_issue`)**: Creates labeled GitHub issues (`["via-cricscore-ai", category]`) in `venkatesh-singamsetty/cricscore` via server-side `GITHUB_TOKEN`, enforcing a 2-step confirmation flow (asks for title/description if generic) and a 1-issue-per-message rate limit (`docs/github_issue_agent.md`).
  - State is strictly bounded with recursion caps, tool call limits, and error recovery.
  - Optional LangSmith tracing (`tracing.py`) enabled via `LANGCHAIN_TRACING_V2=true`.

- **Stdio Model Context Protocol (MCP) Server (`cricscore_ai/mcp_server.py`)**:
  - Exposes approved CricScore tools (`get_match_details`, `get_match_statistics`, `list_recent_matches`, `search_tournament_rules`, `get_model_metadata`, `predict_match_outcome`, `create_github_issue`, `get_match_weather`) over JSON-RPC stdio.

## 2. In-Process MCP Server & Chat Security Boundaries

- **Strict Read-Only Chat Guarantee**:
  - The `/chat` endpoint is intentionally open without a JWT authorizer so that both fans and guests can consult the AI assistant.
  - **Client `isAdmin` is strictly ignored**: Destructive data-purging tools (`delete_guest_data`, `delete_incomplete_matches`) are permanently disabled from chat execution loops to prevent prompt injection or flag spoofing. Admin data purges must be executed through authenticated Match Ops Admin Panel routes.
  - **SQL Execution Guard (`execute_sql.js`)**: All queries are pre-validated to ensure a single `SELECT` or `WITH` statement, rejecting write/DDL keywords (`DELETE`, `UPDATE`, `DROP`, `ALTER`, `INSERT`) and dangerous functions (`pg_sleep`, `pg_read_file`, `dblink`), wrapped in a `BEGIN READ ONLY;` transaction with a 3-second statement timeout.
  - **Admin-Protected Rulebooks**: `POST /rules/upload`, `GET /rules`, and `DELETE /rules` are guarded by API Gateway Cognito JWT authorizers and verified server-side (`auth.js`) for the `Admin` group or `ADMIN_REPORT_EMAIL`.

## 3. Live Match Context Injection & Provider Configuration

- **Provider Configuration**:
  - Uses `OPENAI_API_KEY` or `LLM_API_KEY`, `LLM_BASE_URL` (default `https://api.openai.com/v1`), `LLM_MODEL` (default `gpt-4o-mini`), and `EMBEDDING_MODEL` (`text-embedding-3-small`, 1536 dimensions).
- **Live Match Context Injection (`chatHandler.js` & `ChatComponent.tsx`)**:
  - When viewing a match, `ChatComponent.tsx` passes `matchContext` (teams, live score, target, overs, recent balls, batter/bowler stats) so the assistant answers live tactical, DLS, and win-probability questions accurately without extra round-trips.
  - Quick-action chips adapt dynamically: live match tactical chips when a match is active; general cricket history chips otherwise.

## 4. Multi-Agent Test Suite Invariants (Weather, RAG, DB, GitHub)

The AI test battery MUST verify all 4 specialist agent categories across all three layers (Python AI service, Node.js Lambda adapter, and React frontend) using at least 2 canonical questions matching `QUICK_PROMPTS` in `ChatComponent.tsx`:

1. **Weather Agent (`get_match_weather`)**:
   - Canonical prompts: _"Can you check the weather report for our match?"_, _"What is the weather forecast for tomorrow in Chicago?"_, _"Will rain interrupt play today?"_
   - Verifies 2-step flow: asks for city/ground if omitted, calls Open-Meteo with coordinates, returns DLS rain advisories.
2. **RAG Agent (`search_tournament_rules`)**:
   - Canonical prompts: _"What are the Powerplay rules?"_, _"Wide vs No-Ball: Which takes precedence?"_, _"How many fielders are allowed outside the circle?"_
   - Verifies `pgvector` similarity search, strict evidence grounding (Rule 8), zero hallucination on missing rules, and citation chips.
3. **Database / Match Info Agent (`execute_sql`)**:
   - Canonical prompts: _"Can you analyze the current match details?"_, _"Who won Player of the Match in the last match?"_, _"What was the score of the latest match?"_
   - Verifies single-statement read-only SELECT execution, safe aggregation, and match context injection.
4. **GitHub Issue Agent (`create_github_issue`)**:
   - Canonical prompts: _"I want to report a bug or request a new feature"_, _"Report a bug in the mobile scoreboard: overs counter overlaps"_
   - Verifies 2-step confirmation prompt, rate limit (max 1 issue per message), and GitHub issue link formatting.

## 5. Testing & Validation Commands

- **Python AI service**: `PYTHONPATH=apps/ai-service apps/ai-service/.venv/bin/pytest apps/ai-service -q`
- **Backend adapter**: `npm --prefix apps/backend test -- lambdas/chat-api/`
- **Frontend chat component**: `npm --prefix apps/frontend test -- --run src/test/ChatComponent.test.tsx`
- **Playwright E2E**: `apps/e2e/tests/ai-api.spec.ts` (verifies 401 on rulebooks, 200 on predictions, refusal of destructive delete requests).
