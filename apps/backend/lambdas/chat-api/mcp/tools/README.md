# 🛠️ MCP Tools

Tools exposed to the Agentic LLM via the Model Context Protocol.

## Available Tools

1. **`execute_sql`**: (Text-to-SQL RAG)
   - Allows the LLM to write and execute SQL queries against the Aiven PostgreSQL database.
   - **Security**: Forced into a `READ ONLY` transaction block with a `statement_timeout` of 3 seconds. Any failure triggers an automatic rollback.
2. **`search_tournament_rules`**: (Vector RAG)
   - Allows the LLM to search through uploaded tournament rulebooks.
   - Computes an embedding for the user's query and performs a `pgvector` cosine similarity (`<=>`) search to find the most relevant chunks of text.
3. **`send_email`**: (Action)
   - Sends HTML emails via AWS SES.
4. **`delete_match`**: (Action)
   - Deletes matches from the database. Supports single ID, multiple IDs, or "ALL".
   - **Security**: Endpoint protected and requires `auth_admin` verified on the frontend.
