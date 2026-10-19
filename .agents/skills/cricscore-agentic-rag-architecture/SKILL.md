---
name: cricscore-agentic-rag-architecture
description: Use when changing CricScore chat, LLM provider configuration, MCP tools, SQL or vector retrieval, rulebook ingestion, or AI summaries.
---

# CricScore Agentic RAG & AI Architecture

Use `docs/ai_architecture.md`, `apps/backend/lambdas/chat-api/`, and `apps/frontend/src/components/ChatComponent.tsx` as the source of truth.

## 1. Provider Configuration & Cost Control

- **OpenAI-Compatible Client (`apps/backend/lambdas/chat-api/llmClient.js`)**:
  - Uses `OPENAI_API_KEY` or `LLM_API_KEY`, `LLM_BASE_URL` (default `https://api.openai.com/v1`), `LLM_MODEL` (default `gpt-4o-mini`), and `EMBEDDING_MODEL` (`text-embedding-3-small`, 1536 dimensions).
  - Keep token limits, tool-call iteration caps, and retrieval top-K (`LIMIT 8` for `pgvector` similarity search) bounded to control latency and LLM cost.

## 2. In-Process MCP Server & Security Boundaries

- **MCP Tools (`apps/backend/lambdas/chat-api/mcp/server.js` & `mcp/tools/`)**:
  - Read tools: `search_rules` (`pgvector` cosine similarity on `rule_chunks`), `query_postgres` (read-only `SELECT` against match/innings/balls tables), `get_System_health`.
  - Admin-only tools (`delete_match`, `cleanup_matches_by_date`): Must verify `isAdmin` server-side before executing any destructive SQL. Never expose admin mutation tools or prompts to non-admin users.
- **Live Match Context Injection (`chatHandler.js` & `ChatComponent.tsx`)**:
  - When a user asks a question while viewing a match, `ChatComponent.tsx` passes `matchContext` (teams, live score, target, overs, recent balls, batter/bowler stats) so `chatHandler.js` can answer live tactical and DLS/win-probability questions accurately without unnecessary round-trips.
  - Keep quick-action chips in `ChatComponent.tsx` context-aware (live match chips when `matchContext` is active; general cricket/history chips otherwise; admin chips only when `isAdmin` is true).

## 3. Rulebook Ingestion & Testing

- Rulebook PDF uploads (`uploadRulesHandler.js`) validate admin authorization, parse text chunks, generate 1536-dim embeddings, and replace document chunks transactionally in `rule_chunks`.
- Run `npm --prefix apps/backend test` and `npm --prefix apps/frontend test -- --run src/test/ChatComponent.test.tsx` whenever chat handlers, MCP tools, or `ChatComponent.tsx` change.
