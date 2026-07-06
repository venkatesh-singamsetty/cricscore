# 🔌 Model Context Protocol (MCP) Server

This directory implements an MCP Server using the official `@modelcontextprotocol/sdk`.

The MCP server acts as a secure bridge between the LLM and the CricScore backend systems (Database, third-party APIs).

- **`server.js`**: Defines the `cricscore-mcp-server` and registers the available tools.
- **`tools/`**: Contains the individual tool implementations that the LLM can call.
