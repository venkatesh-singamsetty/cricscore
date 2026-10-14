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
        const tA = m.team_a_name || "Team A";
        const tB = m.team_b_name || "Team B";
        const isTeamABattingFirst = m.bat_first_team === tA;

        const team1 = isTeamABattingFirst ? tA : tB;
        const team1Score = isTeamABattingFirst
          ? m.team_a_score || 0
          : m.team_b_score || 0;
        const team1Wickets = isTeamABattingFirst
          ? m.team_a_wickets || 0
          : m.team_b_wickets || 0;
        const team1Overs = isTeamABattingFirst
          ? m.team_a_overs || "0.0"
          : m.team_b_overs || "0.0";

        const team2 = isTeamABattingFirst ? tB : tA;
        const team2Score = isTeamABattingFirst
          ? m.team_b_score || 0
          : m.team_a_score || 0;
        const team2Wickets = isTeamABattingFirst
          ? m.team_b_wickets || 0
          : m.team_a_wickets || 0;
        const team2Overs = isTeamABattingFirst
          ? m.team_b_overs || "0.0"
          : m.team_a_overs || "0.0";

        const getBalls = (overStr) => {
          const parts = String(overStr).split(".");
          return (
            (parseInt(parts[0], 10) || 0) * 6 + (parseInt(parts[1], 10) || 0)
          );
        };
        const t1Balls = getBalls(team1Overs);
        const t2Balls = getBalls(team2Overs);
        const t1RR =
          t1Balls > 0 ? (team1Score / (t1Balls / 6)).toFixed(1) : "0.0";
        const t2RR =
          t2Balls > 0 ? (team2Score / (t2Balls / 6)).toFixed(1) : "0.0";

        matchContext = `Active Match: ${tA} vs ${tB} (Status: ${m.status}). Toss: ${m.toss_winner || "TBD"} elected to ${m.toss_decision || "TBD"}. Total Match Overs: ${m.total_overs || 0}.
[1st Innings - ${team1}]: ${team1Score}/${team1Wickets} in ${team1Overs} overs (CRR: ${t1RR})
[2nd Innings - ${team2}]: ${team2Score}/${team2Wickets} in ${team2Overs} overs (CRR: ${t2RR})`;

        if (
          t2Balls > 0 ||
          t1Balls === m.total_overs * 6 ||
          team1Wickets === 10
        ) {
          const target = team1Score + 1;
          const runsNeeded = target - team2Score;
          const ballsLeft = (m.total_overs || 0) * 6 - t2Balls;
          if (m.status !== "COMPLETED") {
            matchContext += `\nTarget for ${team2}: ${target} runs. They need ${runsNeeded} runs to win from ${ballsLeft} balls.`;
          }
        }
      }
    }
  } catch (err) {
    console.error("chatHandler: context fetch error:", err);
  } finally {
    dbClient.release();
  }

  // Step 2: Build system prompt with tool routing instructions
  const adminOnlyInstructions = isAdmin
    ? `
6. DELETE MATCHES (ADMIN): If the user asks to delete matches, you MUST first call 'execute_sql' to fetch the matching records, show them to the user, and explicitly ask for confirmation. ONLY call 'delete_match' AFTER the user says "yes" or confirms the deletion.
7. DELETE GUEST DATA (ADMIN): If the user asks to delete, clear, or prune guest users, guest matches, or guest details → ALWAYS call 'delete_guest_data'. Do NOT ask for confirmation first, just execute the tool.
8. DELETE INCOMPLETE MATCHES (ADMIN): If the user asks to delete incomplete matches → ALWAYS call 'delete_incomplete_matches'. Do NOT ask for confirmation first, just execute the tool.
`
    : `
6. ADMIN-ONLY ACTIONS: Do not discuss, suggest, or perform guest cleanup, match deletion, or any other admin-only action unless the caller is explicitly an admin. If a non-admin asks for these actions, politely refuse and explain that admin privileges are required.
`;
  const systemPrompt = `You are CricScore AI, an expert cricket analyst for this specific tournament.

## TOOL ROUTING RULES (MANDATORY):
1. DATABASE QUERIES: If the user asks about matches, scores, stats, players, or standings → ALWAYS call 'execute_sql'.
2. RULEBOOK QUERIES: If the user asks ANYTHING about rules, regulations, formats, timings, breaks, eligibility, penalties, tiebreakers, LBW, weather, DLS, or any tournament policy → ALWAYS call 'search_tournament_rules' FIRST before answering. Do NOT answer from general cricket knowledge. The rulebook has the tournament-specific rules that override general cricket knowledge.
3. NEVER answer a rulebook-type question from memory. Always search first, then answer based on the retrieved chunks. YOU MUST explicitly cite the [Source: document_name] provided in the search results so the user knows which rulebook the answer comes from.
4. SCALED RULES: If the active match is shorter than a full tournament match, you MUST automatically scale rules like Powerplay proportionally based on the Active Match's Total Overs (e.g., if the rulebook specifies 8 powerplay overs for a 25-over match, a 10-over match has a 3-over powerplay).
5. OFF-TOPIC: Refuse anything unrelated to cricket. Do not treat guest cleanup, match deletion, or other admin-only actions as normal cricket questions for non-admin users.
6. COMPLETE RESPONSES: When the user requests details for N items (e.g., "latest 10 matches"), you MUST list ALL requested items. Use a clear, concise bullet/number format (Match #, Teams, Score, Winner) so all items are presented fully.
7. COMPREHENSIVE RULE SYNTHESIS: When answering rulebook queries, read all retrieved chunks thoroughly and cover all relevant sub-rules (such as Mandatory Powerplay, Batting Powerplay, and Fielding Restrictions) completely.
8. STRICT RULEBOOK TRUTH (NO HALLUCINATIONS): Tournament rules override standard international rules. If the retrieved rulebook chunk states "No runs for Leg Byes", you MUST explicitly state that NO RUNS are scored for leg byes in this tournament and that leg byes do NOT count as extras or add to team totals. NEVER state that leg byes add to team totals if the retrieved rulebook says otherwise. State EXACTLY what the retrieved rulebook specifies.
9. ACTIVE MATCH CONTEXT: If the user asks about the "live match" or "current match", you MUST use the provided 'Current Active Match Context' below. You do not need to query the database to summarize the current active match score, as the detailed context is provided directly in this prompt. Summarize it in a friendly, conversational, and highly detailed manner.
${adminOnlyInstructions}## Database Schema:
${DB_SCHEMA}

## Database Hints:
- The 'status' column uses UPPERCASE: 'SCHEDULED', 'LIVE', 'COMPLETED', 'ABANDONED'.
- Use ILIKE for case-insensitive string matching.
- For 'today', use: created_at >= NOW() - INTERVAL '24 hours'.
- PostgreSQL STRICT GROUP BY: Any column selected that is not inside an aggregate function (SUM, AVG, COUNT) MUST be explicitly listed in the GROUP BY clause!
- Team Names: There is no 'team_name' column. Use 'batting_team_name' or 'bowling_team_name' from the innings table.
- Averages: AVG(runs) works, but remember to cast to float if needed. Strike rate is (SUM(runs) / SUM(balls_faced)) * 100.
- For 'latest' or 'last', ALWAYS use: ORDER BY created_at DESC LIMIT 1. (Or LIMIT N when N matches are requested).

Current Active Match Context: ${matchContext || "None provided"}
Current Date and Time: ${new Date().toISOString()}
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
      max_tokens: 2000,
    });
  } catch (err) {
    console.error("chatHandler: LLM call error:", err);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        reply:
          "I'm currently experiencing high traffic and cannot process this request. Please check the live scoreboard for updates.",
      }),
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
    try {
      response = await openai.chat.completions.create({
        model: LLM_MODEL,
        messages,
        tools,
        temperature: 0.5,
        max_tokens: 2000,
      });
      responseMessage = response.choices[0].message;
    } catch (err) {
      console.error("chatHandler: Final LLM call error:", err);
      responseMessage = {
        content:
          "I'm unable to synthesize the full answer right now, but you can check the scoreboard for the latest updates.",
      };
    }
  }

  const finalReply =
    responseMessage.content ||
    "The operation was completed, but no detailed summary was generated.";

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ reply: finalReply }),
  };
}

module.exports = { chatHandler };
