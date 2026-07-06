const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");
const { executeSqlTool } = require("./tools/executeSql");
const { searchRulesTool } = require("./tools/searchRules");

/**
 * Creates and configures the CricScore MCP Server.
 *
 * The MCP Server acts as the secure tool executor. It:
 * 1. Registers all available tools with their input schemas (for LLM discovery)
 * 2. Handles actual execution when the LLM decides to call a tool
 * 3. Keeps all credentials (DATABASE_URL, LLM_API_KEY) AWAY from the LLM
 *
 * Used with InMemoryTransport — runs entirely within the Lambda execution
 * environment at zero extra infrastructure cost.
 *
 * To add a new tool:
 *   1. Create a new file in ./tools/myTool.js
 *   2. Import and register it here with server.tool(...)
 *
 * @returns {McpServer} Configured MCP server instance
 */
function createCricScoreMcpServer() {
  const server = new McpServer({
    name: "CricScore MCP Server",
    version: "2.0.0",
  });

  // Tool: execute_sql — Text-to-SQL RAG for live match data
  server.tool(
    "execute_sql",
    "Execute a READ-ONLY SQL query against the CricScore PostgreSQL database to retrieve match scores, player stats, innings data, or historical results.",
    {
      query: z
        .string()
        .describe(
          "The PostgreSQL SELECT query to execute. Must be read-only. Do not use INSERT, UPDATE, DELETE, or DROP.",
        ),
    },
    executeSqlTool,
  );

  // Tool: search_tournament_rules — Vector RAG for rulebook PDF
  server.tool(
    "search_tournament_rules",
    "Search the tournament rulebook PDF for specific rules, regulations, timings, eligibility criteria, tiebreaker policies, or any tournament-specific procedure.",
    {
      query: z
        .string()
        .describe(
          "A natural language description of the rule or situation to search for in the tournament rulebook.",
        ),
    },
    searchRulesTool,
  );

  return server;
}

module.exports = { createCricScoreMcpServer };
