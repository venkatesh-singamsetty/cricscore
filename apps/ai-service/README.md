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
