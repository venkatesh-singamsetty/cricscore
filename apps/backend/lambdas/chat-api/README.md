# 🤖 Agentic AI Chat API

This serverless AWS Lambda provides the core backend for the CricScore AI Assistant. It implements an Agentic RAG (Retrieval-Augmented Generation) pipeline using the **Model Context Protocol (MCP)**.

## Architecture

- **`index.js`**: The main entry point that routes HTTP endpoints (`POST /`, `POST /summary`, `POST /upload-rules`).
- **`handlers/`**: Contains the business logic for the various endpoints.
- **`mcp/`**: Contains the MCP server implementation and tool definitions for the agent to securely query the database.
- **`config/`**: Centralized configurations for Database (Aiven PostgreSQL) and LLM (OpenAI/OpenRouter).

## Security

The AI agent interacts with the PostgreSQL database strictly via MCP tools. The LLM provider (e.g. OpenRouter) is completely decoupled from database credentials, ensuring a strong security posture.
