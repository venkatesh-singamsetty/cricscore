---
name: cricscore-agentic-rag-architecture
description: Standards and guidelines for the AI Chat Assistant, Agentic RAG pipeline, pgvector similarity search, and Model Context Protocol (MCP) integrations.
---

# CricScore Agentic RAG & AI Architecture

This skill governs modifications to the CricScore AI Chat Assistant.

## 1. LLM Integration & Providers

- The platform uses `OpenRouter` to proxy requests to `OpenAI`.
- Default models are `gpt-4o-mini` for fast inference and `text-embedding-3-small` for vector embeddings.
- **Cost Guardrail**: All prompts must enforce strict max-tokens and chunking (e.g. 1,000 char chunks) to prevent runaway costs.

## 2. Model Context Protocol (MCP) Boundaries

- Never expose raw database credentials to the LLM.
- The architecture implements an **MCP Server** that safely wraps database operations. The LLM acts as an MCP Client and invokes tools (e.g., executing a SQL query) over a secured boundary.

## 3. Retrieval-Augmented Generation (RAG)

- Vector storage is handled by **Aiven PostgreSQL** using the `pgvector` extension.
- Similarity searches use the HNSW index for high performance.
- When adjusting prompt limits, ensure `LIMIT 8` (or similar constraints) is applied to vector retrieval to cap context window usage.
