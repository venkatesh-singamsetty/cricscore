# CricScore AI Service (Python)

LangGraph supervisor + validated read-only tools. **Status: Phases 2–3 of the plan (service core). Not yet wired into the Node `chat-api`, not deployed.**

- `cricscore_ai/router.py` – deterministic intent classifier (`match_info`, `rules`, `analysis`, `prediction`, `clarify`, `refuse`).
- `cricscore_ai/graph.py` – acyclic LangGraph: `classify → one specialist → synthesize`; max 3 tool calls, recursion limit 12.
- `cricscore_ai/tools.py` – parameterized-query match tools, pgvector rules search, prediction input validation.
- `cricscore_ai/repository.py` – read-only Postgres access (READ ONLY txn, 3s timeout, row limits, no `scorer_email`). Use a read-only role via `AI_DATABASE_URL`.
- `cricscore_ai/providers.py` – OpenAI-compatible LLM/embeddings (paid, optional) and the existing `ml-predict` Lambda client.
- `cricscore_ai/tracing.py` – LangSmith is off unless `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY` are set; payloads hidden.
- `cricscore_ai/handler.py` – Lambda handler (invoke-only; no public route).

## Local test

```bash
cd apps/ai-service
python3.12 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/pytest -q
```

## Env vars (placeholders)

`AI_DATABASE_URL` (or `DATABASE_URL`), `DB_SCHEMA`, `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, `EMBEDDING_MODEL`, `ML_PREDICT_FUNCTION`, optional `LANGSMITH_TRACING`, `LANGSMITH_API_KEY`.

## MCP server (Phase 4)

Read-only tools for MCP clients (Claude Desktop, Cursor, MCP Inspector): `get_match_details`, `get_match_statistics`, `list_recent_matches`, `search_tournament_rules`, `get_model_metadata`, `predict_match_outcome`. They call the same validated functions as the LangGraph agents (`tools.py`); there are no write/admin/SQL tools. Errors are returned as `{"error": "<safe message>"}`.

- **Transport:** local stdio only. It trusts the operator's local environment (`AI_DATABASE_URL`, keys), so use a read-only DB role. A remote transport is intentionally not implemented; it must be authenticated before exposure.
- **Run:** `.venv/bin/python -m cricscore_ai.mcp_server`
- **Inspect:** `npx @modelcontextprotocol/inspector .venv/bin/python -m cricscore_ai.mcp_server`
- **Client config example:** `{"mcpServers":{"cricscore":{"command":"/abs/path/apps/ai-service/.venv/bin/python","args":["-m","cricscore_ai.mcp_server"],"cwd":"/abs/path/apps/ai-service","env":{"AI_DATABASE_URL":"<read-only-url>","DB_SCHEMA":"dev","LLM_API_KEY":"<key>"}}}}`
- `get_model_metadata` reads `apps/ml-engine/live_metadata.json` (override with `ML_METADATA_PATH`).
- Note: pinned to `mcp` 2.x (`MCPServer`); v1 code using `FastMCP` is not compatible.
