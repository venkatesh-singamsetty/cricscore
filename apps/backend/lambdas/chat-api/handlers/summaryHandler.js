const { openai, LLM_MODEL } = require("../config/llm");
const { pool, setSearchPath } = require("../config/db");

const stripPomSentenceFromSummary = (text = "") =>
  String(text)
    .replace(/\s*Player of the Match\s*[:\-]?[^\n.]+(?:\.\s|\n|$)/gi, "")
    .replace(/\s*POM\s*[:\-]?[^\n.]+(?:\.\s|\n|$)/gi, "")
    .trim();

const formatOvers = (overs, balls) => {
  const o = parseInt(overs, 10) || 0;
  const b = parseInt(balls, 10) || 0;

  if (o === 0 && b === 0) return "0 balls";
  if (o === 0) return `${b} ball${b !== 1 ? "s" : ""}`;
  if (b === 0) return `${o} over${o !== 1 ? "s" : ""}`;
  return `${o} over${o !== 1 ? "s" : ""} and ${b} ball${b !== 1 ? "s" : ""}`;
};

/**
 * Deterministically computes the Player of the Match using a multi-dimensional
 * Cricket MVP Impact formula (batting runs, share of team score, boundaries,
 * strike rate vs match par, bowling wickets scaled by match totals, economy vs
 * match RPO, maidens, all-rounder synergy, and winning-team bonus).
 */
function computePlayerOfTheMatch({
  batters = [],
  bowlers = [],
  matchWinner = "",
  teamAName = "",
  teamBName = "",
  inn1 = null,
  inn2 = null,
}) {
  const candidates = new Map();

  const getKey = (name, team) =>
    `${String(name || "")
      .trim()
      .toUpperCase()}::${String(team || "")
      .trim()
      .toUpperCase()}`;

  const ensureCandidate = (name, team) => {
    const key = getKey(name, team);
    if (!candidates.has(key)) {
      candidates.set(key, {
        name: String(name || "").trim(),
        team: String(team || "").trim(),
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        isOut: null,
        wickets: 0,
        runsConceded: 0,
        overs: 0,
        bowlerBalls: 0,
        maidens: 0,
      });
    }
    return candidates.get(key);
  };

  for (const b of batters) {
    if (!b || !b.name) continue;
    const c = ensureCandidate(b.name, b.team || b.batting_team_name);
    c.runs += Number(b.runs || 0);
    c.balls += Number(b.balls ?? b.balls_faced ?? b.ballsFaced ?? 0);
    c.fours += Number(b.fours || 0);
    c.sixes += Number(b.sixes || 0);
    if (b.isOut !== undefined || b.is_out !== undefined) {
      c.isOut = Boolean(b.isOut ?? b.is_out);
    }
  }

  for (const bw of bowlers) {
    if (!bw || !bw.name) continue;
    const c = ensureCandidate(bw.name, bw.team || bw.bowling_team_name);
    c.wickets += Number(bw.wickets || 0);
    c.runsConceded += Number(bw.runsConceded ?? bw.runs_conceded ?? 0);
    c.overs += Number(bw.overs ?? bw.overs_completed ?? 0);
    c.bowlerBalls += Number(bw.balls || 0);
    c.maidens += Number(bw.maidens || 0);
  }

  const allCandidates = Array.from(candidates.values()).filter(
    (c) => c.runs > 0 || c.wickets > 0 || c.overs > 0 || c.bowlerBalls > 0,
  );

  if (allCandidates.length === 0) {
    return null;
  }

  // Determine winning team name
  const winnerUpper = String(matchWinner || "")
    .trim()
    .toUpperCase();
  const teamAUpper = String(teamAName || "")
    .trim()
    .toUpperCase();
  const teamBUpper = String(teamBName || "")
    .trim()
    .toUpperCase();
  let winningTeamUpper = "";

  if (teamAUpper && winnerUpper.includes(teamAUpper)) {
    winningTeamUpper = teamAUpper;
  } else if (teamBUpper && winnerUpper.includes(teamBUpper)) {
    winningTeamUpper = teamBUpper;
  } else if (inn1 && inn2) {
    const r1 = Number(inn1.total_runs ?? inn1.totalRuns ?? 0);
    const r2 = Number(inn2.total_runs ?? inn2.totalRuns ?? 0);
    const t1 = String(inn1.batting_team_name ?? inn1.battingTeamName ?? "")
      .trim()
      .toUpperCase();
    const t2 = String(inn2.batting_team_name ?? inn2.battingTeamName ?? "")
      .trim()
      .toUpperCase();
    if (r1 > r2) winningTeamUpper = t1;
    else if (r2 > r1) winningTeamUpper = t2;
  }

  const inn1Runs = Number(inn1?.total_runs ?? inn1?.totalRuns ?? 0);
  const inn2Runs = Number(inn2?.total_runs ?? inn2?.totalRuns ?? 0);
  const maxBatterRuns = Math.max(0, ...allCandidates.map((c) => c.runs));
  const maxTeamRuns = Math.max(inn1Runs, inn2Runs, maxBatterRuns, 1);

  const inn1Balls = Number(inn1?.overs || 0) * 6 + Number(inn1?.balls || 0);
  const inn2Balls = Number(inn2?.overs || 0) * 6 + Number(inn2?.balls || 0);
  const totalMatchRuns =
    inn1Runs + inn2Runs ||
    allCandidates.reduce((sum, c) => sum + c.runs, 0) ||
    1;
  const totalMatchBalls =
    inn1Balls + inn2Balls ||
    allCandidates.reduce((sum, c) => sum + c.balls, 0) ||
    6;
  const matchRPO = (totalMatchRuns / Math.max(totalMatchBalls, 1)) * 6;

  for (const c of allCandidates) {
    let batPts = 0;
    if (c.runs > 0) {
      const runPts = c.runs * 1.0;
      const sharePts = (c.runs / Math.max(maxTeamRuns, 10)) * 20.0;
      const boundaryPts = c.fours * 1.5 + c.sixes * 2.5;
      const playerRPO = c.balls > 0 ? (c.runs / c.balls) * 6 : matchRPO;
      const srPts =
        c.balls > 0
          ? Math.max(
              -4.0,
              Math.min(8.0, (playerRPO - matchRPO) * (c.balls / 6) * 2.0),
            )
          : 0;
      const milestonePts =
        c.runs >= 100 ? 16 : c.runs >= 50 ? 8 : c.runs >= 25 ? 4 : 0;
      const notOutPts = c.isOut === false && c.runs >= 4 ? 2.0 : 0;
      batPts =
        runPts + sharePts + boundaryPts + srPts + milestonePts + notOutPts;
    }

    let bowlPts = 0;
    if (c.wickets > 0 || c.overs > 0 || c.bowlerBalls > 0) {
      const wicketVal = Math.min(18.0, Math.max(8.0, maxTeamRuns * 0.65));
      const wicketPts = c.wickets * wicketVal;
      const haulPts =
        c.wickets >= 5 ? 12 : c.wickets >= 3 ? 6 : c.wickets >= 2 ? 3 : 0;
      const maidenPts = c.maidens * 6.0;
      const totalBowlBalls = c.overs * 6 + c.bowlerBalls;
      const bowlOversDec =
        totalBowlBalls > 0
          ? totalBowlBalls / 6
          : c.wickets > 0 || c.runsConceded > 0
            ? 1.0
            : 0;
      const bowlerRPO =
        bowlOversDec > 0 ? c.runsConceded / bowlOversDec : matchRPO;
      const econPts =
        bowlOversDec > 0
          ? Math.max(
              -8.0,
              Math.min(10.0, (matchRPO - bowlerRPO) * bowlOversDec * 2.5),
            )
          : 0;
      bowlPts = Math.max(0, wicketPts + haulPts + maidenPts + econPts);
    }

    const rawPts = batPts + bowlPts;
    const isWinner =
      Boolean(winningTeamUpper) &&
      c.team.trim().toUpperCase() === winningTeamUpper;
    c.batPts = batPts;
    c.bowlPts = bowlPts;
    c.isWinner = isWinner;
    c.totalPts = isWinner && rawPts > 0 ? rawPts * 1.35 + 5.0 : rawPts;
  }

  allCandidates.sort((a, b) => {
    if (Math.abs(b.totalPts - a.totalPts) > 0.01)
      return b.totalPts - a.totalPts;
    if (a.isWinner !== b.isWinner) return a.isWinner ? -1 : 1;
    const boundaryScoreA = a.fours * 4 + a.sixes * 6;
    const boundaryScoreB = b.fours * 4 + b.sixes * 6;
    if (boundaryScoreB !== boundaryScoreA)
      return boundaryScoreB - boundaryScoreA;
    if (b.runs !== a.runs) return b.runs - a.runs;
    if (b.wickets !== a.wickets) return b.wickets - a.wickets;
    if (a.balls !== b.balls) return a.balls - b.balls;
    return a.name.localeCompare(b.name);
  });

  const best = allCandidates[0];
  const boundaryParts = [];
  if (best.fours > 0) boundaryParts.push(`${best.fours}x4`);
  if (best.sixes > 0) boundaryParts.push(`${best.sixes}x6`);
  const boundarySuffix =
    boundaryParts.length > 0 ? ` (${boundaryParts.join(", ")})` : "";

  if (best.runs > 0 && best.wickets > 0) {
    return `${best.name} - scored ${best.runs} runs (${best.balls} balls)${boundarySuffix} & took ${best.wickets} wicket${best.wickets === 1 ? "" : "s"} for ${best.runsConceded} runs`;
  }
  if (best.batPts >= best.bowlPts && best.runs > 0) {
    return `${best.name} - scored ${best.runs} run${best.runs === 1 ? "" : "s"} off ${best.balls} ball${best.balls === 1 ? "" : "s"}${boundarySuffix}`;
  }
  if (best.wickets > 0) {
    return `${best.name} - took ${best.wickets} wicket${best.wickets === 1 ? "" : "s"} for ${best.runsConceded} runs`;
  }
  return `${best.name} - scored ${best.runs} runs`;
}

function extractMatchDataStats(data = {}) {
  const batters = [];
  const bowlers = [];
  const inningsList = [data.previousInnings, data.currentInnings].filter(
    Boolean,
  );

  inningsList.forEach((inn) => {
    const batTeam = inn.battingTeamName || inn.batting_team_name || "";
    const bowlTeam = inn.bowlingTeamName || inn.bowling_team_name || "";
    if (inn.players) {
      const playerArr = Array.isArray(inn.players)
        ? inn.players
        : Object.values(inn.players);
      playerArr.forEach((p) => {
        if ((p.runs || 0) > 0) {
          batters.push({
            name: p.name,
            team: batTeam,
            batting_team_name: batTeam,
            runs: Number(p.runs || 0),
            balls: Number(p.ballsFaced ?? p.balls_faced ?? 0),
            balls_faced: Number(p.ballsFaced ?? p.balls_faced ?? 0),
            fours: Number(p.fours || 0),
            sixes: Number(p.sixes || 0),
            isOut: Boolean(p.isOut ?? p.is_out),
          });
        }
      });
    }
    if (inn.bowlers) {
      const bowlerArr = Array.isArray(inn.bowlers)
        ? inn.bowlers
        : Object.values(inn.bowlers);
      bowlerArr.forEach((b) => {
        const overs = Number(b.overs ?? b.overs_completed ?? 0);
        const balls = Number(b.balls || 0);
        const wickets = Number(b.wickets || 0);
        const runsConceded = Number(b.runsConceded ?? b.runs_conceded ?? 0);
        if (wickets > 0 || overs > 0 || balls > 0 || runsConceded > 0) {
          bowlers.push({
            name: b.name,
            team: bowlTeam,
            bowling_team_name: bowlTeam,
            wickets,
            runsConceded,
            runs_conceded: runsConceded,
            overs,
            overs_completed: overs,
            balls,
            maidens: Number(b.maidens || 0),
          });
        }
      });
    }
  });

  batters.sort(
    (a, b) =>
      b.runs - a.runs ||
      b.fours * 4 + b.sixes * 6 - (a.fours * 4 + a.sixes * 6) ||
      a.balls - b.balls,
  );
  bowlers.sort(
    (a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded,
  );

  return { batters, bowlers, inningsList };
}

/**
 * Generates an AI-powered post-match summary using match statistics
 * fetched directly from the database (or local guest state) and a
 * deterministic Player of the Match calculation so Scorer, Viewer,
 * Email, and S3 Backup are always 100% identical.
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

  const isLocalGuestMatch = !matchId || String(matchId).startsWith("guest_");

  // Handle pure local / guest match payload (no cloud DB row)
  if (isLocalGuestMatch && matchData) {
    try {
      const data = matchData;
      const teamAName = data.teamAName || data.teamA?.name || "Team A";
      const teamBName = data.teamBName || data.teamB?.name || "Team B";
      const matchWinner =
        data.winnerMessage || data.matchWinner || "Match Completed";
      const tossWinner = data.tossWinner || teamAName;
      const tossDecision = data.tossDecision || "BAT";

      const inn1 = data.previousInnings || data.currentInnings || null;
      const inn2 = data.previousInnings ? data.currentInnings : null;

      const score1Text = inn1
        ? `Score 1 (${inn1.battingTeamName}): ${inn1.totalRuns} runs for ${inn1.totalWickets} wickets in ${formatOvers(inn1.overs, inn1.balls)}`
        : "Score 1: Not started";
      const score2Text = inn2
        ? `Score 2 (${inn2.battingTeamName}): ${inn2.totalRuns} runs for ${inn2.totalWickets} wickets in ${formatOvers(inn2.overs, inn2.balls)}`
        : "Score 2: Not started";

      const { batters, bowlers } = extractMatchDataStats(data);
      const deterministicPom = computePlayerOfTheMatch({
        batters,
        bowlers,
        matchWinner,
        teamAName,
        teamBName,
        inn1,
        inn2,
      });

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
2. You MUST state the EXACT final team scores based on the data below. Do NOT alter, recalculate, or invent any score, ball count, or wicket count. Write it naturally, e.g., "Team A scored 100 runs for 2 wickets in 10 overs."
3. State the official match winner: "${matchWinner}".
${deterministicPom ? `4. Official Player of the Match is "${deterministicPom}". Use this exact value for playerOfTheMatch.` : ""}

Respond with a JSON object in this exact format:
{
  "summary": "Your concise summary...",
  "playerOfTheMatch": "${deterministicPom || "Name of the POM - brief reason"}"
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
      const playerOfTheMatch =
        deterministicPom || resultJSON.playerOfTheMatch || null;

      const summary = playerOfTheMatch
        ? `🏆 Player of the Match: ${playerOfTheMatch}\n\n${stripPomSentenceFromSummary(rawSummary)}`
        : stripPomSentenceFromSummary(rawSummary);

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
      `SELECT p.name, p.runs, p.balls_faced, p.fours, p.sixes, p.is_out, i.batting_team_name
       FROM players p
       JOIN innings i ON p.inning_id = i.id
       WHERE i.match_id = $1 AND p.runs > 0
       ORDER BY p.runs DESC, (p.fours * 4 + p.sixes * 6) DESC, p.balls_faced ASC LIMIT 10`,
      [matchId],
    );

    // Fetch top bowling performances
    const bowlersRes = await client.query(
      `SELECT b.name, b.wickets, b.runs_conceded, b.overs_completed, b.balls, b.maidens, i.bowling_team_name
       FROM bowlers b
       JOIN innings i ON b.inning_id = i.id
       WHERE i.match_id = $1 AND (b.wickets > 0 OR b.overs_completed > 0 OR b.balls > 0 OR b.runs_conceded > 0)
       ORDER BY b.wickets DESC, b.runs_conceded ASC LIMIT 10`,
      [matchId],
    );

    // Read overs and balls directly from innings table.
    const ballCountRes = await client.query(
      `SELECT i.id, i.batting_team_name, i.inning_number, i.total_runs, i.total_wickets,
              i.overs, i.balls
       FROM innings i
       WHERE i.match_id = $1
       ORDER BY i.inning_number`,
      [matchId],
    );

    // Merge with fresher matchData from Scorer if SQS storage-worker hasn't flushed the final ball yet
    const fallbackStats = matchData ? extractMatchDataStats(matchData) : null;
    const dbBattersRuns = (battersRes.rows || []).reduce(
      (s, r) => s + Number(r.runs || 0),
      0,
    );
    const fallbackBattersRuns = (fallbackStats?.batters || []).reduce(
      (s, r) => s + Number(r.runs || 0),
      0,
    );

    const activeBatters =
      fallbackStats && fallbackBattersRuns > dbBattersRuns
        ? fallbackStats.batters
        : battersRes.rows || [];
    const activeBowlers =
      fallbackStats &&
      (bowlersRes.rows || []).length === 0 &&
      fallbackStats.bowlers.length > 0
        ? fallbackStats.bowlers
        : bowlersRes.rows || [];

    const dbInn1 = (ballCountRes.rows || []).find((r) => r.inning_number === 1);
    const dbInn2 = (ballCountRes.rows || []).find((r) => r.inning_number === 2);
    const fbInn1 = matchData?.previousInnings || null;
    const fbInn2 = matchData?.previousInnings
      ? matchData?.currentInnings
      : null;

    const inn1 =
      fbInn1 && Number(fbInn1.totalRuns || 0) > Number(dbInn1?.total_runs || 0)
        ? {
            batting_team_name: fbInn1.battingTeamName,
            total_runs: fbInn1.totalRuns,
            total_wickets: fbInn1.totalWickets,
            overs: fbInn1.overs,
            balls: fbInn1.balls,
          }
        : dbInn1;

    const inn2 =
      fbInn2 && Number(fbInn2.totalRuns || 0) > Number(dbInn2?.total_runs || 0)
        ? {
            batting_team_name: fbInn2.battingTeamName,
            total_runs: fbInn2.totalRuns,
            total_wickets: fbInn2.totalWickets,
            overs: fbInn2.overs,
            balls: fbInn2.balls,
          }
        : dbInn2;

    const score1Overs = inn1 ? formatOvers(inn1.overs, inn1.balls) : "0 balls";
    const score2Overs = inn2 ? formatOvers(inn2.overs, inn2.balls) : "0 balls";

    const score1Text = inn1
      ? `Score 1 (${inn1.batting_team_name}): ${inn1.total_runs} runs for ${inn1.total_wickets} wickets in ${score1Overs}`
      : "Score 1: Not started";
    const score2Text = inn2
      ? `Score 2 (${inn2.batting_team_name}): ${inn2.total_runs} runs for ${inn2.total_wickets} wickets in ${score2Overs}`
      : "Score 2: Not started";

    const effectiveWinner =
      m.match_winner || matchData?.winnerMessage || "Match Completed";

    const deterministicPom = computePlayerOfTheMatch({
      batters: activeBatters,
      bowlers: activeBowlers,
      matchWinner: effectiveWinner,
      teamAName: m.team_a_name,
      teamBName: m.team_b_name,
      inn1,
      inn2,
    });

    // Build LLM prompt with match context
    const prompt = `You are a strict, factual cricket analyst.
Generate a concise 1-2 paragraph post-match summary for the following match using ONLY the exact factual numbers provided.

CRITICAL INSTRUCTIONS:
1. Start directly with the toss details: "${m.toss_winner || m.team_a_name} won the toss and elected to ${m.toss_decision || "BAT"}."
2. You MUST state the EXACT final team scores based on the data below. Do NOT alter, recalculate, or invent any score, ball count, or wicket count. Write it naturally, e.g., "Team A scored 100 runs for 2 wickets in 10 overs."
3. State the official match winner: "${effectiveWinner}".
4. Add a brief section analyzing "Game-Changing Moments" based STRICTLY on the top batting and bowling performances provided below. Do NOT hallucinate events, players, or boundaries that are not present in the statistics below.
${deterministicPom ? `5. Official Player of the Match is "${deterministicPom}". Use this exact value for playerOfTheMatch.` : ""}

Respond with a JSON object in this exact format:
{
  "summary": "Your concise summary...",
  "playerOfTheMatch": "${deterministicPom || "Name of the POM - brief reason (e.g., scored 50 runs, or took 3 wickets)"}"
}

MATCH STATISTICS:
Match: ${m.team_a_name} vs ${m.team_b_name}
Result/Status: ${m.status} (Winner: ${effectiveWinner})
${score1Text}
${score2Text}

Top Batting Performances:
${
  activeBatters.length > 0
    ? activeBatters
        .slice(0, 5)
        .map(
          (b) =>
            `- ${b.name} (${b.batting_team_name || b.team}): ${b.runs} off ${b.balls_faced ?? b.balls} balls (${b.fours || 0}x4, ${b.sixes || 0}x6)`,
        )
        .join("\n")
    : "None"
}

Top Bowling Performances:
${
  activeBowlers.length > 0
    ? activeBowlers
        .slice(0, 5)
        .map(
          (b) =>
            `- ${b.name} (${b.bowling_team_name || b.team}): ${b.wickets} wickets for ${b.runs_conceded ?? b.runsConceded} runs`,
        )
        .join("\n")
    : "None"
}`;

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
    playerOfTheMatch = deterministicPom || resultJSON.playerOfTheMatch || null;

    summary = playerOfTheMatch
      ? `🏆 Player of the Match: ${playerOfTheMatch}\n\n${stripPomSentenceFromSummary(rawSummary)}`
      : stripPomSentenceFromSummary(rawSummary);

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

module.exports = { summaryHandler, computePlayerOfTheMatch };
