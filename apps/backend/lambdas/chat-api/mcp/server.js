const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { z } = require("zod");
const { executeSqlTool } = require("./tools/executeSql");
const { searchRulesTool } = require("./tools/searchRules");
const { createGithubIssueTool } = require("./tools/createGithubIssue");
const { getMatchWeatherTool } = require("./tools/getMatchWeather");
const { deleteGuestDataTool } = require("./tools/deleteGuestData");
const {
  deleteIncompleteMatchesTool,
} = require("./tools/deleteIncompleteMatches");

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
function createCricScoreMcpServer(pool, isAdmin) {
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

  // Tool: create_github_issue — GitHub Issue Specialist Agent
  server.tool(
    "create_github_issue",
    "Create a GitHub issue in the official CricScore repository when a user wants to report a bug, UI problem, or request a new feature and has provided clear details (or confirmed the issue details).",
    {
      title: z
        .string()
        .describe(
          "A concise, descriptive title for the GitHub issue (at least 5 characters).",
        ),
      description: z
        .string()
        .describe(
          "Detailed explanation of the bug, UI issue, or feature request (at least 10 characters).",
        ),
      category: z
        .enum(["bug", "feature-request", "feedback"])
        .optional()
        .describe(
          "Issue category: 'bug', 'feature-request', or 'feedback'. Defaults to 'bug'.",
        ),
    },
    createGithubIssueTool,
  );

  // Tool: get_match_weather — Cricket Match Weather Report Specialist Agent
  server.tool(
    "get_match_weather",
    "Fetch live and hourly weather forecast (temperature, rain probability %, precipitation mm, wind speed, humidity, and DLS rain advisory) for a cricket match location using Open-Meteo (free, no key required). Use this when a user asks about weather for a live match (next few hours) or tomorrow's/upcoming match at a specific city or venue.",
    {
      location: z
        .string()
        .describe(
          "City, town, or venue location (e.g., 'Chicago, IL', 'Schaumburg', 'Dallas').",
        ),
      targetDate: z
        .string()
        .optional()
        .describe(
          "Target date for the match forecast: 'today' (for live/current match next few hours), 'tomorrow' (for tomorrow's match), or 'YYYY-MM-DD'. Defaults to 'today'.",
        ),
      hoursAhead: z
        .number()
        .optional()
        .describe(
          "Number of hours ahead to forecast when targetDate is 'today' (1 to 24, default 6).",
        ),
    },
    getMatchWeatherTool,
  );

  if (isAdmin) {
    server.tool(
      "delete_guest_data",
      "Delete all guest users and guest matches from the system. Guests are temporary shadow accounts. Use this when the admin asks to clear, delete, or prune guest data.",
      {},
      deleteGuestDataTool,
    );

    server.tool(
      "delete_incomplete_matches",
      "Delete all matches from the database that are NOT in 'COMPLETED' or 'ABANDONED' status. Use this when the admin asks to delete incomplete matches.",
      {},
      deleteIncompleteMatchesTool,
    );
  }

  return server;
}

module.exports = { createCricScoreMcpServer };
