const { openai, LLM_MODEL } = require("../config/llm");
const { pool, setSearchPath } = require("../config/db");
const { createCricScoreMcpServer } = require("../mcp/server");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } = require("@modelcontextprotocol/sdk/inMemory.js");

/**
 * Succinct DB schema string injected into the LLM system prompt.
 * Gives the LLM enough context to generate accurate SQL queries
 * without exposing unnecessary schema details.
 */
const DB_SCHEMA = `
matches(id, team_a_name, team_b_name, total_overs, bat_first_team, team_a_score, team_a_wickets, team_a_overs, team_b_score, team_b_wickets, team_b_overs, status, match_winner, toss_winner, toss_decision)
innings(id, match_id, inning_number, batting_team_name, bowling_team_name, total_runs, total_wickets, overs, balls, is_completed)
players(id, inning_id, name, runs, balls_faced, fours, sixes, is_out, wicket_type, batting_position)
bowlers(id, inning_id, name, overs_completed, runs_conceded, wickets)
ball_events(id, inning_id, over_number, ball_number, bowler_name, batter_name, runs, is_extra, extra_type, extra_runs, is_wicket, wicket_type)
`;

/**
 * Handles the main /chat endpoint.
 *
 * Flow:
 * 1. Fetch active match context from DB (if matchId provided)
 * 2. Spin up MCP Server + Client using InMemoryTransport (zero cost)
 * 3. Discover tools from MCP Server and pass schemas to LLM
 * 4. LLM decides which tool(s) to call (if any)
 * 5. Delegate tool calls back to MCP Server for secure execution
 * 6. Final LLM call generates the human-readable response
 *
 * @param {object} body - Parsed request body
 * @param {object} corsHeaders - CORS headers to include in response
 * @returns {object} Lambda response object
 */
async function chatHandler(body, corsHeaders) {
  const { message, matchId, history = [], isAdmin = false } = body;

  if (!message) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Message is required" }),
    };
  }

  // Step 1: Fetch active match context
  let matchContext = "";
  const dbClient = await pool.connect();
  try {
    await setSearchPath(dbClient);
    if (matchId) {
      const matchRes = await dbClient.query(
        "SELECT * FROM matches WHERE id = $1",
        [matchId],
      );
      if (matchRes.rows.length > 0) {
        const m = matchRes.rows[0];
        matchContext = `Active Match: ${m.team_a_name} vs ${m.team_b_name} (${m.status}). Total Overs: ${m.total_overs}. Score: ${m.team_a_score}/${m.team_a_wickets} & ${m.team_b_score}/${m.team_b_wickets}. Toss: ${m.toss_winner} elected to ${m.toss_decision}.`;
      }
    }
  } catch (err) {
    console.error("chatHandler: context fetch error:", err);
  } finally {
    dbClient.release();
  }

  // Step 2: Build system prompt with tool routing instructions
  const systemPrompt = `You are CricScore AI, an expert cricket analyst for this specific tournament.

## TOOL ROUTING RULES (MANDATORY):
1. DATABASE QUERIES: If the user asks about matches, scores, stats, players, or standings → ALWAYS call 'execute_sql'.
2. RULEBOOK QUERIES: If the user asks ANYTHING about rules, regulations, formats, timings, breaks, eligibility, penalties, tiebreakers, LBW, weather, DLS, or any tournament policy → ALWAYS call 'search_tournament_rules' FIRST before answering. Do NOT answer from general cricket knowledge. The rulebook has the tournament-specific rules that override general cricket knowledge.
3. NEVER answer a rulebook-type question from memory. Always search first, then answer based on the retrieved chunks. YOU MUST explicitly cite the [Source: document_name] provided in the search results so the user knows which rulebook the answer comes from.
4. SCALED RULES: If the active match is shorter than a full tournament match, you MUST automatically scale rules like Powerplay proportionally based on the Active Match's Total Overs (e.g., if the rulebook specifies 8 powerplay overs for a 25-over match, a 10-over match has a 3-over powerplay).
5. OFF-TOPIC: Refuse anything unrelated to cricket. NOTE: Deleting matches and sending emails ARE valid cricket administrative tasks. Do NOT refuse them as off-topic.
6. DELETE MATCHES (ADMIN): If the user asks to delete matches, you MUST first call 'execute_sql' to fetch the matching records, show them to the user, and explicitly ask for confirmation. ONLY call 'delete_match' AFTER the user says "yes" or confirms the deletion.

## Database Schema:
${DB_SCHEMA}

## Database Hints:
- The 'status' column uses UPPERCASE: 'SCHEDULED', 'LIVE', 'COMPLETED', 'ABANDONED'.
- Use ILIKE for case-insensitive string matching.
- For 'today', use: created_at >= NOW() - INTERVAL '24 hours'.

Current Active Match Context: ${matchContext || "None provided"}
`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: message },
  ];

  // Step 3: Initialize MCP Server + Client (in-memory, zero infrastructure cost)
  const mcpServer = createCricScoreMcpServer(pool, isAdmin);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await mcpServer.connect(serverTransport);

  const mcpClient = new Client(
    { name: "chat-api-client", version: "1.0.0" },
    { capabilities: {} },
  );
  await mcpClient.connect(clientTransport);

  // Step 4: Discover tools from MCP Server — clean up $schema for OpenAI compatibility
  const mcpToolsList = await mcpClient.listTools();
  const tools = mcpToolsList.tools.map((t) => {
    const { $schema, additionalProperties, ...cleanSchema } = t.inputSchema;
    return {
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: cleanSchema,
      },
    };
  });

  // Step 5: Initial LLM call
  let response;
  try {
    response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.1,
      max_tokens: 500,
    });
  } catch (err) {
    console.error("chatHandler: LLM call error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "LLM processing failed" }),
    };
  }

  let responseMessage = response.choices[0].message;

  // Step 6: Agentic tool call loop — delegate to MCP Server for secure execution
  if (responseMessage.tool_calls) {
    messages.push(responseMessage);

    for (const toolCall of responseMessage.tool_calls) {
      console.log(
        "chatHandler: delegating to MCP tool:",
        toolCall.function.name,
      );
      let toolResult = "";

      try {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await mcpClient.callTool({
          name: toolCall.function.name,
          arguments: args,
        });

        toolResult =
          result?.content?.length > 0
            ? result.content[0].text
            : "No results returned by tool.";
      } catch (err) {
        console.error("chatHandler: MCP tool error:", err);
        toolResult = "Error executing tool: " + err.message;
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult,
      });
    }

    // Final LLM call — generate human-readable answer from tool results
    response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages,
      temperature: 0.5,
      max_tokens: 500,
    });
    responseMessage = response.choices[0].message;
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ reply: responseMessage.content }),
  };
}

module.exports = { chatHandler };
