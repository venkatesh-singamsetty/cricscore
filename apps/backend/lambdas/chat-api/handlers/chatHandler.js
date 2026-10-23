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
matches(id, team_a_name, team_b_name, total_overs, bat_first_team, team_a_score, team_a_wickets, team_a_overs, team_b_score, team_b_wickets, team_b_overs, status, match_winner, player_of_the_match, ai_summary, toss_winner, toss_decision, created_at)
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
  const { message, matchId } = body;
  // SECURITY: chat is read-only for everyone. The client-supplied `isAdmin` flag is
  // intentionally ignored (the /chat route is unauthenticated), so destructive MCP
  // tools can never be registered from this path. Deletions live in Match Ops.
  const isAdmin = false;
  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (h) =>
            h &&
            (h.role === "user" || h.role === "assistant") &&
            typeof h.content === "string",
        )
        .slice(-10)
    : [];

  if (!message) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Message is required" }),
    };
  }

  // Step 1: Fetch active match context (only when matchId is provided)
  let matchContext = "";
  if (matchId) {
    try {
      const dbClient = await pool.connect();
      try {
        await setSearchPath(dbClient);
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
      } finally {
        dbClient.release();
      }
    } catch (err) {
      console.error("chatHandler: context fetch error:", err);
    }
  }

  // Step 2: Build system prompt with tool routing instructions
  const adminOnlyInstructions = isAdmin
    ? `
6. DO NOT DELETE ALL MATCHES: You CANNOT and MUST NOT delete all matches from the database. Deleting all matches is a restricted safeguard operation that must be performed directly from the Match Ops (Admin Panel) with typed confirmation. If an admin asks to delete all matches or wipe all database records, politely decline and instruct them to use the Match Ops (Admin Panel).
7. DELETE GUEST DATA (ADMIN): If the admin asks to delete, clear, or prune guest users, guest matches, or guest details → ALWAYS call 'delete_guest_data'. Do NOT ask for confirmation first, just execute the tool.
8. DELETE INCOMPLETE MATCHES (ADMIN): If the admin asks to delete incomplete matches → ALWAYS call 'delete_incomplete_matches'. Do NOT ask for confirmation first, just execute the tool.
`
    : `
6. READ-ONLY CHAT: You cannot delete, modify or clean up any data. If asked to delete matches, guest data or any records, politely refuse and explain that admins must do this from the Match Ops (Admin Panel).
`;
  const systemPrompt = `You are CricScore AI, an expert cricket analyst for this specific tournament.

## TOOL ROUTING RULES (MANDATORY):
1. DATABASE QUERIES: If the user asks about matches, scores, stats, players, or standings → ALWAYS call 'execute_sql'.
2. RULEBOOK QUERIES: If the user asks ANYTHING about rules, regulations, formats, timings, breaks, eligibility, penalties, tiebreakers, LBW, DLS rules, or any tournament policy → ALWAYS call 'search_tournament_rules' FIRST before answering. Do NOT answer from general cricket knowledge. The rulebook has the tournament-specific rules that override general cricket knowledge. (Note: if the user asks for an actual live or upcoming weather forecast/report for a match or location, use Rule 11 'get_match_weather' instead).
3. NEVER answer a rulebook-type question from memory. Always search first, then answer based on the retrieved chunks. YOU MUST explicitly cite the [Source: document_name] provided in the search results so the user knows which rulebook the answer comes from.
4. SCALED RULES: If the active match is shorter than a full tournament match, you MUST automatically scale rules like Powerplay proportionally based on the Active Match's Total Overs (e.g., if the rulebook specifies 8 powerplay overs for a 25-over match, a 10-over match has a 3-over powerplay).
5. OFF-TOPIC: Refuse anything unrelated to cricket or the CricScore platform (note: raising/reporting CricScore app bugs, UI issues, or feature requests on GitHub IS supported via Rule 10, and checking match weather reports IS supported via Rule 11). Do not treat guest cleanup, match deletion, or other admin-only actions as normal cricket questions for non-admin users.
6. COMPLETE RESPONSES: When the user requests details for N items (e.g., "latest 10 matches"), you MUST list ALL requested items. Use a clear, concise bullet/number format (Match #, Teams, Score, Winner) so all items are presented fully.
7. COMPREHENSIVE RULE SYNTHESIS: When answering rulebook queries, read all retrieved chunks thoroughly and cover all relevant sub-rules (such as Mandatory Powerplay, Batting Powerplay, and Fielding Restrictions) completely.
8. STRICT RULEBOOK TRUTH (NO HALLUCINATIONS): Tournament rules override standard international rules. If the retrieved rulebook chunk states "No runs for Leg Byes", you MUST explicitly state that NO RUNS are scored for leg byes in this tournament and that leg byes do NOT count as extras or add to team totals. NEVER state that leg byes add to team totals if the retrieved rulebook says otherwise. State EXACTLY what the retrieved rulebook specifies.
9. ACTIVE MATCH CONTEXT: If the user asks about the "live match" or "current match" and 'Current Active Match Context' below is provided (not 'None provided'), summarize it in a friendly, conversational, and detailed manner (and you may also call 'execute_sql' for player/bowler stats). If 'Current Active Match Context' is 'None provided', ALWAYS call 'execute_sql' to fetch the most recent LIVE match (or the most recent match overall via ORDER BY created_at DESC LIMIT 1) along with its innings, players, and bowlers so you can analyze it thoroughly.
10. GITHUB ISSUE AGENT: If a user wants to report a bug, UI problem, or request a new feature (or raise a GitHub issue):
   - If the user has NOT yet provided specific details (for example, if they say "I want to report a bug or request a new feature"), do NOT call 'create_github_issue' yet. Instead, ask them to share a brief title and description of the bug or feature request so you can log it for them.
   - Once the user provides specific details (or confirms a draft in the conversation), call 'create_github_issue' with 'title', 'description', and 'category' ('bug', 'feature-request', or 'feedback'), and include the created Issue # and clickable URL in your response.
11. WEATHER REPORT AGENT: If a user asks about the weather report or forecast for a match (either for the next few hours during a live match, or for tomorrow's/upcoming match at a specific time and location):
   - If the user has NOT specified a city/ground/location (either in their current message or earlier in the conversation history — for example, clicking "Can you check the weather report for our match?"), do NOT call 'get_match_weather' yet. Politely ask which city or ground the match is at, and whether they want the forecast for the next few hours (live match) or for tomorrow's match.
   - Once a location is provided (e.g., "Chicago tomorrow at 2 PM", "Schaumburg for the next 4 hours", or "next 4hrs" when a location was mentioned earlier), ALWAYS call 'get_match_weather' with 'location', 'targetDate' ('today', 'tomorrow', or 'YYYY-MM-DD'), and 'hoursAhead'.
   - PRESENTATION & FORMATTING (CRITICAL - COMPACT & READABLE SUMMARY):
     * Always prominently state the **Current Local Time** and current conditions right at the top for clear time reference (e.g., "**Current Conditions (as of 1:15 AM local time, America/Chicago):** 46°F (8°C) · Clear sky · Humidity 67% · Wind 2 mph").
     * Keep the response compact and avoid huge vertical lists that require excessive scrolling. Use a clean, concise Markdown table for the hourly breakdown (columns: **Time**, **Condition**, **Temp (°F / °C)**, **Rain %**, **Wind**).
     * Follow with a brief 1-2 sentence **Cricket & DLS Advisory** highlighting whether conditions are dry for uninterrupted play or if passing showers require DLS par score monitoring.
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
- Player of the Match: Stored in 'matches.player_of_the_match' (and often mentioned in 'matches.ai_summary'). When asked who won Player of the Match in the last match, query matches WHERE status = 'COMPLETED' ORDER BY created_at DESC LIMIT 1 (including id, team_a_name, team_b_name, match_winner, player_of_the_match, ai_summary), and if player_of_the_match is NULL, also query top batters/bowlers in players/bowlers for that match_id to highlight the standout performer.

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
  const MAX_TOOL_ROUNDS = 2;
  let toolRound = 0;
  let githubIssuesCreatedInTurn = 0;

  while (responseMessage.tool_calls && toolRound < MAX_TOOL_ROUNDS) {
    toolRound += 1;
    messages.push(responseMessage);

    for (const toolCall of responseMessage.tool_calls) {
      console.log(
        `chatHandler: delegating to MCP tool (round ${toolRound}):`,
        toolCall.function.name,
      );
      let toolResult = "";

      if (
        toolCall.function.name === "create_github_issue" &&
        githubIssuesCreatedInTurn >= 1
      ) {
        toolResult =
          "Rate limit: Only 1 GitHub issue can be created per message.";
      } else {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await mcpClient.callTool({
            name: toolCall.function.name,
            arguments: args,
          });
          if (toolCall.function.name === "create_github_issue") {
            githubIssuesCreatedInTurn += 1;
          }

          toolResult =
            result?.content?.length > 0
              ? result.content[0].text
              : "No results returned by tool.";
        } catch (err) {
          console.error("chatHandler: MCP tool error:", err);
          toolResult = "Error executing tool: " + err.message;
        }
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: toolResult,
      });
    }

    // Call LLM again to interpret results or generate follow-up query
    const isFinalRound = toolRound >= MAX_TOOL_ROUNDS;
    try {
      const completionParams = {
        model: LLM_MODEL,
        messages,
        temperature: 0.3,
        max_tokens: 2000,
      };
      if (!isFinalRound) {
        completionParams.tools = tools;
        completionParams.tool_choice = "auto";
      }
      response = await openai.chat.completions.create(completionParams);
      responseMessage = response.choices[0].message;
    } catch (err) {
      console.error("chatHandler: Follow-up LLM call error:", err);
      responseMessage = {
        content:
          "I retrieved the match records, but was unable to synthesize the full answer right now. Please check the scorecard for details.",
      };
      break;
    }
  }

  // If the model still returned tool_calls on the final round without content,
  // do a forced synthesis call strictly without tools so the user receives a readable answer.
  if (!responseMessage.content) {
    try {
      const forcedSynthesis = await openai.chat.completions.create({
        model: LLM_MODEL,
        messages: [
          ...messages,
          {
            role: "user",
            content:
              "Synthesize a clear, direct answer to the user's question using the information and tool results retrieved above. If specific data (such as an official Player of the Match award) is not recorded, state that clearly and summarize the match winner or available player scores.",
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      });
      responseMessage = forcedSynthesis.choices[0].message;
    } catch (synthErr) {
      console.error("chatHandler: Forced synthesis error:", synthErr);
    }
  }

  const finalReply =
    responseMessage.content ||
    "I was able to inspect the database, but could not compile a complete summary. Please check the live scorecard or recent matches for full details.";

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ reply: finalReply }),
  };
}

module.exports = { chatHandler };
