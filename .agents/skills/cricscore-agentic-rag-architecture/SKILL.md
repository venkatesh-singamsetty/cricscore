---
name: cricscore-agentic-rag-architecture
description: Use when changing CricScore chat, LLM provider configuration, MCP tools, SQL or vector retrieval, rulebook ingestion, or AI summaries.
---

# CricScore Agentic RAG, Python AI Service & MCP Architecture

Use `docs/ai_architecture.md`, `apps/ai-service/` (Python LangGraph & MCP), `apps/backend/lambdas/chat-api/` (Node.js Adapter), and `apps/frontend/src/components/ChatComponent.tsx` as the source of truth.

## 1. Multi-Agent Python AI Service (`apps/ai-service`)

- **LangGraph Supervisor & Specialist Agents (`cricscore_ai/`)**:
  - `graph.py` / `router.py`: Classifies user intent and routes between specialist nodes:
    - **Match Info & SQL Agent**: Parameterized and validated read-only SQL queries against PostgreSQL.
    - **Cricket RAG Agent**: `pgvector` similarity search on official tournament rulebooks (`rule_chunks`).
    - **Cricket Analysis Agent**: Synthesizes live match statistics and game progression analysis.
    - **Prediction Agent**: Live win probability and par calculation integration.
  - State is strictly bounded with recursion caps, tool call limits, and error recovery.
  - Optional LangSmith tracing (`tracing.py`) enabled via `LANGCHAIN_TRACING_V2=true`.

- **Stdio Model Context Protocol (MCP) Server (`cricscore_ai/mcp_server.py`)**:
  - Exposes approved CricScore tools (`execute_sql`, `search_rules`, `get_match_summary`, `predict_win_probability`) over JSON-RPC stdio.

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

## 4. Testing & Validation

- Unit tests:
  - Python AI service: `apps/ai-service/.venv/bin/pytest apps/ai-service -q`
  - Backend adapter: `npm --prefix apps/backend test`
  - Frontend chat component: `npm --prefix apps/frontend test -- --run src/test/ChatComponent.test.tsx`
  - Playwright E2E: `apps/e2e/tests/ai-api.spec.ts` (verifies 401 on rulebooks, 200 on predictions, refusal of destructive delete requests).
