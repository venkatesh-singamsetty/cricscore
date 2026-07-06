const { openai, LLM_MODEL } = require("../config/llm");
const { pool, setSearchPath } = require("../config/db");

/**
 * Generates an AI-powered post-match summary using match statistics
 * fetched directly from the database.
 *
 * The summary is cached in the `matches.ai_summary` column after first
 * generation to avoid re-generating on every request.
 *
 * @param {string} matchId - UUID of the match to summarize
 * @param {object} corsHeaders - CORS headers to include in response
 * @returns {object} Lambda response with { summary } or error
 */
async function summaryHandler(matchId, corsHeaders) {
  if (!matchId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "matchId is required" }),
    };
  }

  const client = await pool.connect();
  let summary = "";

  try {
    await setSearchPath(client);

    // Fetch match metadata
    const matchRes = await client.query("SELECT * FROM matches WHERE id = $1", [
      matchId,
    ]);
    if (matchRes.rows.length === 0) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: "Match not found" }),
      };
    }
    const m = matchRes.rows[0];

    // Return cached summary if already generated
    if (m.ai_summary) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ summary: m.ai_summary }),
      };
    }

    // Fetch top batting performances
    const battersRes = await client.query(
      `SELECT p.name, p.runs, p.balls_faced, p.fours, p.sixes, i.batting_team_name
       FROM players p
       JOIN innings i ON p.inning_id = i.id
       WHERE i.match_id = $1 AND p.runs > 0
       ORDER BY p.runs DESC LIMIT 5`,
      [matchId],
    );

    // Fetch top bowling performances
    const bowlersRes = await client.query(
      `SELECT b.name, b.wickets, b.runs_conceded, b.overs_completed, i.bowling_team_name
       FROM bowlers b
       JOIN innings i ON b.inning_id = i.id
       WHERE i.match_id = $1 AND (b.wickets > 0 OR b.overs_completed > 0)
       ORDER BY b.wickets DESC, b.runs_conceded ASC LIMIT 5`,
      [matchId],
    );

    // Read overs and balls directly from innings table.
    // This is the most reliable source of truth, as it is synced exactly with the frontend state.
    const ballCountRes = await client.query(
      `SELECT i.id, i.batting_team_name, i.inning_number, i.total_runs, i.total_wickets,
              i.overs, i.balls
       FROM innings i
       WHERE i.match_id = $1
       ORDER BY i.inning_number`,
      [matchId],
    );

    // Format the overs and balls into plain English
    const formatOvers = (overs, balls) => {
      const o = parseInt(overs, 10) || 0;
      const b = parseInt(balls, 10) || 0;

      if (o === 0 && b === 0) return "0 balls";
      if (o === 0) return `${b} ball${b !== 1 ? "s" : ""}`;
      if (b === 0) return `${o} over${o !== 1 ? "s" : ""}`;
      return `${o} over${o !== 1 ? "s" : ""} and ${b} ball${b !== 1 ? "s" : ""}`;
    };

    const inn1 = ballCountRes.rows.find((r) => r.inning_number === 1);
    const inn2 = ballCountRes.rows.find((r) => r.inning_number === 2);

    const score1Overs = inn1 ? formatOvers(inn1.overs, inn1.balls) : "0 balls";
    const score2Overs = inn2 ? formatOvers(inn2.overs, inn2.balls) : "0 balls";

    const score1Text = inn1
      ? `Score 1: ${inn1.batting_team_name} - ${inn1.total_runs}/${inn1.total_wickets} in ${score1Overs}`
      : "Score 1: Not started";
    const score2Text = inn2
      ? `Score 2: ${inn2.batting_team_name} - ${inn2.total_runs}/${inn2.total_wickets} in ${score2Overs}`
      : "Score 2: Not started";

    // Build LLM prompt with match context
    const prompt = `You are a factual cricket analyst.
Please generate a simple, concise 1-2 paragraph post-match summary for the following match. Do not be overly creative or dramatic. Keep it straightforward.
CRITICAL INSTRUCTIONS:
- Start your response directly with the toss details (e.g. "${m.toss_winner || "Unknown"} won the toss and elected to ${m.toss_decision || "BAT"}"). Do NOT use filler prefixes like "In a completed match," or "In this match,".
- Overs are already pre-calculated in plain English for you below. Use them exactly as written.
At the end, name the "Man of the Match" based on the statistics and give a brief 1 sentence reason.

Match: ${m.team_a_name} vs ${m.team_b_name}
Result/Status: ${m.status} (Winner: ${m.match_winner || "TBD"})
${score1Text}
${score2Text}

Top Batting Performances:
${battersRes.rows
  .map(
    (b) =>
      `- ${b.name} (${b.batting_team_name}): ${b.runs} off ${b.balls_faced} balls (${b.fours}x4, ${b.sixes}x6)`,
  )
  .join("\n")}

Top Bowling Performances:
${bowlersRes.rows
  .map(
    (b) =>
      `- ${b.name} (${b.bowling_team_name}): ${b.wickets}/${b.runs_conceded}`,
  )
  .join("\n")}`;

    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 800,
    });

    summary = response.choices[0].message.content;

    // Cache the summary in the database for future requests
    await client.query("UPDATE matches SET ai_summary = $1 WHERE id = $2", [
      summary,
      matchId,
    ]);
  } catch (err) {
    console.error("summaryHandler error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Failed to generate summary" }),
    };
  } finally {
    client.release();
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ summary }),
  };
}

module.exports = { summaryHandler };
