---
name: cricscore-agentic-rag-architecture
description: Use when changing CricScore chat, LLM provider configuration, MCP tools, SQL or vector retrieval, rulebook ingestion, or AI summaries.
---

# CricScore Agentic RAG & AI Architecture

Use the implementation and [AI architecture guide](../../../docs/ai_architecture.md) as the source of truth; verify details there and in the handlers before changing provider or retrieval behavior.

## Provider configuration

- The chat client uses the OpenAI SDK with `OPENAI_API_KEY` or `LLM_API_KEY`, `LLM_BASE_URL`, and optional `LLM_MODEL`. The configured default endpoint is OpenAI; the default chat model varies by provider.
- Embeddings use the configured OpenAI-compatible endpoint and `EMBEDDING_MODEL`. Confirm the provider supports both the selected chat and embedding models before changing defaults.
- Keep request, input-size, and retrieval limits explicit. Consider provider cost, latency, rate limits, and failure behavior when changing them; do not hard-code a provider or model based on an outdated document.

## MCP and authorization

- The MCP client and server run in-process in `chat-api`; tools are registered in `mcp/server.js` and implemented under `mcp/tools/`.
- Keep database credentials and provider keys in backend configuration only. Tool results and generated SQL may be sent to the configured LLM provider; minimize and scope returned data.
- Treat model output and client-provided fields as untrusted. Enforce authorization in trusted backend code for destructive/admin operations; a client-supplied `isAdmin` flag is not an authorization boundary.
- Keep SQL access read-only, parameterize values, constrain execution time and result size, and test invalid or adversarial tool arguments.

## Retrieval and testing

- Match and historical data uses PostgreSQL through the chat tools. Rulebook chunks and 1536-dimensional embeddings are stored in PostgreSQL with `pgvector`; the current vector search caps results at 8. Verify schema and provider embedding dimensions together before changing the model.
- Rulebook uploads replace chunks by document name. Preserve document scoping and validate file type, size, parsing errors, and database effects when changing ingestion.
- Add or update focused tests in `apps/backend/lambdas/chat-api/` for handler, tool, provider, and retrieval changes. Run `(cd apps/backend && npm test)`.
