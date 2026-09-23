const { openai, LLM_MODEL } = require("../config/llm");
const { pool, setSearchPath } = require("../config/db");

const stripPomSentenceFromSummary = (text = "") =>
  String(text)
    .replace(/\s*Player of the Match\s*[:\-]?[^\n.]+(?:\.\s|\n|$)/gi, "")
    .replace(/\s*POM\s*[:\-]?[^\n.]+(?:\.\s|\n|$)/gi, "")
    .trim();

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
async function summaryHandler(
  matchId,
  corsHeaders,
  forceRefresh = false,
  matchData = null,
) {
  if (!matchId && !matchData) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "matchId or matchData is required" }),
    };
  }

  // Handle local / guest match payload directly
  if (matchData || (matchId && String(matchId).startsWith("guest_"))) {
    try {
      const data = matchData || {};
      const teamAName = data.teamAName || data.teamA?.name || "Team A";
      const teamBName = data.teamBName || data.teamB?.name || "Team B";
      const matchWinner =
        data.winnerMessage || data.matchWinner || "Match Completed";
      const tossWinner = data.tossWinner || teamAName;
      const tossDecision = data.tossDecision || "BAT";

      let score1Text = "Score 1: Not started";
      let score2Text = "Score 2: Not started";

      if (data.previousInnings) {
        const inn1 = data.previousInnings;
        score1Text = `Score 1 (${inn1.battingTeamName}): ${inn1.totalRuns} runs for ${inn1.totalWickets} wickets in ${inn1.overs}.${inn1.balls} overs`;
      }
      if (data.currentInnings) {
        const inn2 = data.currentInnings;
        const text = `Score 2 (${inn2.battingTeamName}): ${inn2.totalRuns} runs for ${inn2.totalWickets} wickets in ${inn2.overs}.${inn2.balls} overs`;
        if (data.previousInnings) {
          score2Text = text;
        } else {
          score1Text = text;
        }
      }

      const batters = [];
      const bowlers = [];
      [data.previousInnings, data.currentInnings]
        .filter(Boolean)
        .forEach((inn) => {
          if (inn.players) {
            Object.values(inn.players).forEach((p) => {
              if (p.runs > 0)
                batters.push({
                  name: p.name,
                  team: inn.battingTeamName,
                  runs: p.runs,
                  balls: p.ballsFaced || 0,
                  fours: p.fours || 0,
                  sixes: p.sixes || 0,
                });
            });
          }
          if (inn.bowlers) {
            Object.values(inn.bowlers).forEach((b) => {
              if (b.wickets > 0 || b.overs > 0)
                bowlers.push({
                  name: b.name,
                  team: inn.bowlingTeamName,
                  wickets: b.wickets || 0,
                  runsConceded: b.runsConceded || 0,
                });
            });
          }
        });

      batters.sort((a, b) => b.runs - a.runs);
      bowlers.sort(
        (a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded,
      );

      const topBattersText =
        batters.length > 0
          ? batters
              .slice(0, 5)
              .map(
                (b) =>
                  `- ${b.name} (${b.team}): ${b.runs} off ${b.balls} balls (${b.fours}x4, ${b.sixes}x6)`,
              )
              .join("\n")
          : "None";
      const topBowlersText =
        bowlers.length > 0
          ? bowlers
              .slice(0, 5)
              .map(
                (b) =>
                  `- ${b.name} (${b.team}): ${b.wickets} wickets for ${b.runsConceded} runs`,
              )
              .join("\n")
          : "None";

      const prompt = `You are a strict, factual cricket analyst.
Generate a concise 1-2 paragraph post-match summary for the following match using ONLY the exact factual numbers provided.

CRITICAL INSTRUCTIONS:
1. Start directly with the toss details: "${tossWinner} won the toss and elected to ${tossDecision}."
2. You MUST state the EXACT final team scores as provided in the Score 1 and Score 2 lines. Do NOT alter, recalculate, or invent any score, ball count, or wicket count. For example: "${score1Text}" and "${score2Text}".
3. State the official match winner: "${matchWinner}".
4. Name the "Player of the Match" (POM) based on top individual performances and state their exact stats in 1 sentence.

Respond with a JSON object in this exact format:
{
  "summary": "Your 4-paragraph summary...",
  "playerOfTheMatch": "Name of the POM"
}

MATCH STATISTICS:
Match: ${teamAName} vs ${teamBName}
Result/Status: COMPLETED (Winner: ${matchWinner})
${score1Text}
${score2Text}

Top Batting Performances:
${topBattersText}

Top Bowling Performances:
${topBowlersText}`;

      const response = await openai.chat.completions.create({
        model: LLM_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.0,
        max_tokens: 800,
        response_format: { type: "json_object" },
      });

      const rawContent = response.choices[0].message.content;
      let resultJSON = {};
      try {
        resultJSON = JSON.parse(rawContent.trim());
      } catch (e) {
        console.error("Failed to parse LLM JSON:", e);
        resultJSON = { summary: rawContent.trim(), playerOfTheMatch: null };
      }

      const rawSummary = resultJSON.summary || rawContent.trim();
      const summary = stripPomSentenceFromSummary(rawSummary);
      const playerOfTheMatch = resultJSON.playerOfTheMatch || null;

      // Save summary and Player of the Match to DB for registered matches
      if (matchId && !String(matchId).startsWith("guest_")) {
        try {
          const client = await pool.connect();
          try {
            await setSearchPath(client);
            await client.query(
              "UPDATE matches SET ai_summary = $1, player_of_the_match = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
              [summary, playerOfTheMatch, matchId],
            );
            console.log(
              `✅ Cached ai_summary & POM (${playerOfTheMatch}) in DB for match ${matchId}`,
            );
          } finally {
            client.release();
          }
        } catch (dbErr) {
          console.error(
            "Failed to update matches table with ai_summary:",
            dbErr,
          );
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ summary, playerOfTheMatch }),
      };
    } catch (err) {
      console.error("Guest summaryHandler error:", err);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Failed to generate summary for guest match",
        }),
      };
    }
  }

  const client = await pool.connect();
  let summary = "";
  let playerOfTheMatch = null;

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

    // Return cached summary if already generated and valid (unless forceRefresh is true)
    if (m.ai_summary && !forceRefresh) {
      const isStaleSummary =
        m.ai_summary.includes("currently live") ||
        m.ai_summary.includes("currently ongoing") ||
        m.ai_summary.includes("ongoing") ||
        m.ai_summary.includes("yet to score") ||
        m.ai_summary.includes("no balls bowled") ||
        m.ai_summary.includes("0/0") ||
        m.ai_summary.includes("yet to begin") ||
        m.ai_summary.includes("0 balls") ||
        m.ai_summary.includes("has not started") ||
        (m.team_a_score > 0 && !m.ai_summary.includes(`${m.team_a_score}`)) ||
        (m.team_b_score > 0 && !m.ai_summary.includes(`${m.team_b_score}`));
      if (!isStaleSummary) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            summary: m.ai_summary,
            playerOfTheMatch: m.player_of_the_match,
          }),
        };
      }
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
      ? `Score 1 (${inn1.batting_team_name}): ${inn1.total_runs} runs for ${inn1.total_wickets} wickets in ${score1Overs}`
      : "Score 1: Not started";
    const score2Text = inn2
      ? `Score 2 (${inn2.batting_team_name}): ${inn2.total_runs} runs for ${inn2.total_wickets} wickets in ${score2Overs}`
      : "Score 2: Not started";

    // Build LLM prompt with match context
    const prompt = `You are a strict, factual cricket analyst.
Generate a concise 1-2 paragraph post-match summary for the following match using ONLY the exact factual numbers provided.

CRITICAL INSTRUCTIONS:
1. Start directly with the toss details: "${m.toss_winner || m.team_a_name} won the toss and elected to ${m.toss_decision || "BAT"}."
2. You MUST state the EXACT final team scores as provided in the Score 1 and Score 2 lines. Do NOT alter, recalculate, or invent any score, ball count, or wicket count. For example: "${score1Text}" and "${score2Text}".
3. State the official match winner: "${m.match_winner || "Match Completed"}".
4. Name the "Player of the Match" (POM) based on top individual performances and state their exact stats in 1 sentence.

Respond with a JSON object in this exact format:
{
  "summary": "Your 4-paragraph summary...",
  "playerOfTheMatch": "Name of the POM"
}

MATCH STATISTICS:
Match: ${m.team_a_name} vs ${m.team_b_name}
Result/Status: ${m.status} (Winner: ${m.match_winner || "TBD"})
${score1Text}
${score2Text}

Top Batting Performances:
${battersRes.rows.length > 0 ? battersRes.rows.map((b) => `- ${b.name} (${b.batting_team_name}): ${b.runs} off ${b.balls_faced} balls (${b.fours}x4, ${b.sixes}x6)`).join("\n") : "None"}

Top Bowling Performances:
${bowlersRes.rows.length > 0 ? bowlersRes.rows.map((b) => `- ${b.name} (${b.bowling_team_name}): ${b.wickets} wickets for ${b.runs_conceded} runs`).join("\n") : "None"}`;

    const response = await openai.chat.completions.create({
      model: LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.0,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const rawContent = response.choices[0].message.content;
    let resultJSON = {};
    try {
      resultJSON = JSON.parse(rawContent.trim());
    } catch (e) {
      console.error("Failed to parse LLM JSON:", e);
      resultJSON = { summary: rawContent.trim(), playerOfTheMatch: null };
    }

    const rawSummary = resultJSON.summary || rawContent.trim();
    summary = stripPomSentenceFromSummary(rawSummary);
    playerOfTheMatch = resultJSON.playerOfTheMatch || null;

    // Cache the summary in the database for future requests
    await client.query(
      "UPDATE matches SET ai_summary = $1, player_of_the_match = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3",
      [summary, playerOfTheMatch, matchId],
    );
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
    body: JSON.stringify({ summary, playerOfTheMatch }),
  };
}

module.exports = { summaryHandler };
