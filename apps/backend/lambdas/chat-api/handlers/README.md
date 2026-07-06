# ⚙️ Handlers

This directory contains the core business logic handlers for the `chat-api` Lambda.

- **`chatHandler.js`**: The main conversational loop. It initializes the MCP client, communicates with the LLM, parses tool calls, executes them via the MCP server, and returns the final augmented response.
- **`summaryHandler.js`**: Generates automated post-match summaries using the LLM and caches them in the PostgreSQL database.
- **`uploadRulesHandler.js`**: Processes uploaded PDF tournament rulebooks. It extracts text, generates vector embeddings using `text-embedding-3-small`, and stores them in the `pgvector` enabled database for similarity search.
