const { Client } = require("pg");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

const lambda = new LambdaClient({});

const broadcastHubUpdate = async (matchId = "global") => {
  if (!process.env.BROADCASTER_LAMBDA) return;
  try {
    await lambda.send(
      new InvokeCommand({
        FunctionName: process.env.BROADCASTER_LAMBDA,
        InvocationType: "Event",
        Payload: JSON.stringify({
          body: JSON.stringify({
            matchId: matchId,
            type: "HUB_UPDATE",
            syncOnly: true,
            timestamp: new Date().toISOString(),
          }),
        }),
      }),
    );
    console.log(`📡 HUB_UPDATE broadcast triggered for match: ${matchId}`);
  } catch (err) {
    console.error("Hub broadcast failed:", err);
  }
};

const sendMatchReportEmail = async (
  matchId,
  emailTo,
  origin,
  reportState,
  client,
  sendToAdmin = false,
) => {
  // Get match details
  const matchRes = await client.query("SELECT * FROM matches WHERE id = $1", [
    matchId,
  ]);
  const matchRecord = matchRes.rows[0];
  if (!matchRecord) return { success: false, error: "Match not found" };

  let inningsToReport = [];

  if (reportState && reportState.innings) {
    console.log("Using provided state for report dispatch.");
    inningsToReport = reportState.innings;
  } else {
    const inningsRes = await client.query(
      "SELECT * FROM innings WHERE match_id = $1 ORDER BY inning_number",
      [matchId],
    );
    for (const inn of inningsRes.rows) {
      const pRes = await client.query(
        "SELECT * FROM players WHERE inning_id = $1 ORDER BY batting_position ASC NULLS LAST, runs DESC",
        [inn.id],
      );
      const bRes = await client.query(
        "SELECT * FROM bowlers WHERE inning_id = $1 ORDER BY wickets DESC",
        [inn.id],
      );
      inningsToReport.push({
        ...inn,
        players: pRes.rows,
        bowlers: bRes.rows,
      });
    }
  }

  const innArr = inningsToReport;

  // Derive result
  let resultText = "MATCH IN PROGRESS";
  if (innArr.length >= 2) {
    const i1 = innArr[0];
    const i2 = innArr[1];
    const r1 = i1.totalRuns !== undefined ? i1.totalRuns : i1.total_runs || 0;
    const r2 = i2.totalRuns !== undefined ? i2.totalRuns : i2.total_runs || 0;
    const w2 =
      i2.totalWickets !== undefined ? i2.totalWickets : i2.total_wickets || 0;
    const t1 = i1.battingTeamName || i1.batting_team_name || "Team 1";
    const t2 = i2.battingTeamName || i2.batting_team_name || "Team 2";
    if (r2 > r1) {
      resultText = `${t2} WON BY ${10 - w2} WICKETS`;
    } else if (r1 > r2) {
      resultText = `${t1} WON BY ${r1 - r2} RUNS`;
    } else {
      resultText = "MATCH TIED";
    }
  } else if (matchRecord.status === "COMPLETED") {
    resultText = "INCOMPLETE / ABANDONED";
  }

  console.log(
    `📧 Preparing SES Email for ${matchId} to ${emailTo}. Result: ${resultText}`,
  );

  let htmlBody = `
    <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: white; padding: 40px; border-radius: 20px;">
        <h1 style="color: #6366f1; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 5px;">🏆 CRICSCORE OFFICIAL REPORT</h1>
        <p style="color: #94a3b8; font-weight: bold; margin-top: 0;">${matchRecord.team_a_name} vs ${matchRecord.team_b_name}</p>
        
        <div style="background: #1e293b; padding: 20px; border-radius: 15px; border: 1px solid rgba(255,255,255,0.05); margin: 20px 0;">
            <h2 style="margin: 0; color: #fb7185; text-transform: uppercase; font-style: italic;">${resultText}</h2>
            <p style="font-size: 14px; color: #94a3b8;">${new Date(matchRecord.created_at).toLocaleString()}</p>
            <a href="${origin || process.env.FRONTEND_URL || "https://cricscore.example.com"}?matchId=${matchId}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 10px; font-weight: bold; margin-top: 10px;">VIEW INTERACTIVE SCORECARD ⚡</a>
        </div>`;

  for (const inn of innArr) {
    const battingTeam =
      inn.batting_team_name || inn.battingTeamName || "Unknown Team";
    const runs =
      inn.total_runs !== undefined ? inn.total_runs : inn.totalRuns || 0;
    const wickets =
      inn.total_wickets !== undefined
        ? inn.total_wickets
        : inn.totalWickets || 0;
    const ov = inn.overs !== undefined ? inn.overs : 0;
    const balls = inn.balls !== undefined ? inn.balls : 0;

    let players = inn.players || [];
    let bowlers = inn.bowlers || [];

    if (!inn.players || !inn.bowlers) {
      const pR = await client.query(
        "SELECT * FROM players WHERE inning_id = $1 ORDER BY batting_position ASC NULLS LAST, runs DESC",
        [inn.id],
      );
      const bR = await client.query(
        "SELECT * FROM bowlers WHERE inning_id = $1 ORDER BY wickets DESC",
        [inn.id],
      );
      players = pR.rows;
      bowlers = bR.rows;
    } else {
      if (!Array.isArray(players)) players = Object.values(players);
      if (!Array.isArray(bowlers)) bowlers = Object.values(bowlers);

      players.sort((a, b) => {
        const posA =
          a.battingPosition !== undefined
            ? a.battingPosition
            : a.batting_position !== undefined
              ? a.batting_position
              : 999;
        const posB =
          b.battingPosition !== undefined
            ? b.battingPosition
            : b.batting_position !== undefined
              ? b.batting_position
              : 999;
        if (posA !== posB) return posA - posB;
        return (b.runs || 0) - (a.runs || 0);
      });
      bowlers.sort(
        (a, b) =>
          (b.wickets || (b.runsConceded ? 0 : -1)) -
          (a.wickets || (a.runsConceded ? 0 : -1)),
      );
    }

    htmlBody += `
        <div style="margin-top: 40px;">
            <h3 style="background: #334155; padding: 10px 20px; border-radius: 8px; color: #e2e8f0; margin-bottom: 10px;">🏏 ${battingTeam} - ${runs}/${wickets} (${ov}.${balls})</h3>
        <table style="width: 100%; border-collapse: collapse; text-align: left; background: rgba(255,255,255,0.02); border-radius: 10px; overflow: hidden;">
            <thead>
                <tr style="background: rgba(255,255,255,0.05); color: #94a3b8; font-size: 12px; text-transform: uppercase;">
                    <th style="padding: 12px;">Batter</th><th style="padding: 12px;">R</th><th style="padding: 12px;">B</th><th style="padding: 12px;">4s/6s</th>
                </tr>
            </thead>
            <tbody>`;

    players
      .filter((p) => (p.balls_faced || p.ballsFaced) > 0 || p.is_out)
      .forEach((p) => {
        const r = p.runs || 0;
        const b = p.balls_faced || p.ballsFaced || 0;
        const f = p.fours || 0;
        const s = p.sixes || 0;
        htmlBody += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <td style="padding: 12px; font-weight: bold;">${p.name} ${p.is_out ? "" : "*"}</td>
                    <td style="padding: 12px;">${r}</td>
                    <td style="padding: 12px; color: #64748b;">${b}</td>
                    <td style="padding: 12px; color: #64748b;">${f}/${s}</td>
                </tr>`;
      });

    htmlBody += `</tbody></table></div>`;

    // --- BOWLING SECTION ---
    htmlBody += `
        <div style="margin-top: 20px;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; background: rgba(255,255,255,0.02); border-radius: 10px; overflow: hidden;">
                <thead>
                    <tr style="background: rgba(255,255,255,0.05); color: #94a3b8; font-size: 12px; text-transform: uppercase;">
                        <th style="padding: 12px;">Bowler</th><th style="padding: 12px;">O</th><th style="padding: 12px;">M</th><th style="padding: 12px;">R</th><th style="padding: 12px;">W</th>
                    </tr>
                </thead>
                <tbody>`;

    bowlers
      .filter((b) => (b.overs_completed || b.overs) > 0 || (b.balls || 0) > 0)
      .forEach((b) => {
        const ov = b.overs_completed || b.overs || 0;
        const balls = b.balls || 0;
        const runs = b.runs_conceded || b.runsConceded || 0;
        htmlBody += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <td style="padding: 12px; font-weight: bold;">${b.name}</td>
                    <td style="padding: 12px;">${ov}.${balls}</td>
                    <td style="padding: 12px; color: #64748b;">${b.maidens || 0}</td>
                    <td style="padding: 12px;">${runs}</td>
                    <td style="padding: 12px; color: #fb7185; font-weight: 800;">${b.wickets}</td>
                </tr>`;
      });

    htmlBody += `</tbody></table></div>`;
  }

  htmlBody += `<p style="text-align: center; color: #475569; font-size: 12px; margin-top: 40px;">Generated securely via CricScore on AWS</p></div>`;

  const ses = new SESClient({ region: "us-east-1" });
  let adminEmailSent = false;
  let scorerEmailSent = false;

  // --- 1. SEND TO ADMIN ---
  if (sendToAdmin && process.env.ADMIN_REPORT_EMAIL) {
    try {
      await ses.send(
        new SendEmailCommand({
          Destination: { ToAddresses: [process.env.ADMIN_REPORT_EMAIL] },
          Message: {
            Body: { Html: { Charset: "UTF-8", Data: htmlBody } },
            Subject: {
              Charset: "UTF-8",
              Data: `🏏 ADMIN REPORT: ${matchRecord.team_a_name} vs ${matchRecord.team_b_name}`,
            },
          },
          Source: process.env.SES_SOURCE || "noreply@example.com",
        }),
      );
      console.log("✅ Admin Email Sent Successfully 📡");
      adminEmailSent = true;
    } catch (err) {
      console.error("❌ Admin Email Failed:", err.message);
    }
  }

  // --- 2. SEND TO SCORER ---
  if (emailTo && emailTo !== process.env.ADMIN_REPORT_EMAIL) {
    try {
      await ses.send(
        new SendEmailCommand({
          Destination: { ToAddresses: [emailTo] },
          Message: {
            Body: { Html: { Charset: "UTF-8", Data: htmlBody } },
            Subject: {
              Charset: "UTF-8",
              Data: `🏏 FINAL SCORECARD: ${matchRecord.team_a_name} vs ${matchRecord.team_b_name}`,
            },
          },
          Source: process.env.SES_SOURCE || "noreply@example.com",
        }),
      );
      console.log("✅ Scorer Email Sent Successfully ⚽");
      scorerEmailSent = true;
    } catch (err) {
      console.warn(
        "⚠️ Scorer Email Rejected (Likely Sandbox mode):",
        err.message,
      );
    }
  }

  // After sending emails, we log them into the DB
  if (adminEmailSent && process.env.ADMIN_REPORT_EMAIL) {
    try {
      await client.query(
        "INSERT INTO sent_emails (match_id, email_address, recipient_type) VALUES ($1, $2, $3)",
        [matchId, process.env.ADMIN_REPORT_EMAIL, "ADMIN"],
      );
    } catch (e) {
      console.error("Failed to log admin email to DB:", e.message);
    }
  }

  if (scorerEmailSent && emailTo) {
    try {
      await client.query(
        "INSERT INTO sent_emails (match_id, email_address, recipient_type) VALUES ($1, $2, $3)",
        [matchId, emailTo, "SCORER"],
      );
    } catch (e) {
      console.error("Failed to log scorer email to DB:", e.message);
    }
  }

  return { adminEmailSent, scorerEmailSent };
};

exports.handler = async (event) => {
  const cleanDbUrl = (process.env.DATABASE_URL || "").split("?")[0];
  const client = new Client({
    connectionString: cleanDbUrl,
    // codeql[js/disabling-certificate-validation] Aiven DB requires this unless explicit CA bundle is provided
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await client.connect();
    const dbSchema = process.env.DB_SCHEMA || "public";
    if (process.env.NODE_ENV !== "test") {
      await client.query(`SET search_path TO ${dbSchema}`);
    }

    const { path, httpMethod, body, pathParameters } = event;

    // GET /health — DB connectivity check
    if (httpMethod === "GET" && path === "/health") {
      try {
        await client.query("SELECT 1 AS ok");
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            status: "healthy",
            database: "connected",
            timestamp: new Date().toISOString(),
          }),
        };
      } catch (dbErr) {
        console.error("❌ Health check DB failure:", dbErr.message);
        return {
          statusCode: 503,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
          body: JSON.stringify({
            status: "unhealthy",
            database: "disconnected",
            error: dbErr.message,
            timestamp: new Date().toISOString(),
          }),
        };
      }
    }

    // DELETE /matches (Purge All)
    if (httpMethod === "DELETE" && path === "/matches") {
      try {
        // TRUNCATE is faster and cleans identity counters
        await client.query(
          "TRUNCATE table ball_events, players, bowlers, innings, matches RESTART IDENTITY CASCADE",
        );
        console.log(
          `🧨 DATABASE PURGE SIGNAL RECEIVED - FULL CLEANUP COMPLETED.`,
        );

        // 📡 Notify viewers to clear list
        await broadcastHubUpdate();
        return {
          statusCode: 200,
          body: JSON.stringify({ message: "Database purged" }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        };
      } catch (err) {
        console.error(`❌ PURGE FAILED:`, err);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: err.message }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        };
      }
    }

    // DELETE /match/{matchId}
    if (httpMethod === "DELETE" && pathParameters && pathParameters.matchId) {
      const matchId = pathParameters.matchId;
      try {
        // leveraging ON DELETE CASCADE
        const res = await client.query("DELETE FROM matches WHERE id = $1", [
          matchId,
        ]);

        console.log(
          `🗑️ SUCCESS: Match ${matchId} deleted from records. (Cascading cleanup triggered)`,
        );

        // 📡 Notify viewers to refresh list
        await broadcastHubUpdate(matchId);

        return {
          statusCode: 200,
          body: JSON.stringify({
            message: "Match deleted successfully",
            deletedCount: res.rowCount,
          }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        };
      } catch (err) {
        console.error(`❌ DELETE FAILED for Match ${matchId}:`, err);
        return {
          statusCode: 500,
          body: JSON.stringify({
            error: err.message || "Database request failed.",
          }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        };
      }
    }

    // Handle CORS Preflight (Updated Methods)
    if (httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        body: "",
      };
    }

    if (httpMethod === "POST" && path === "/match") {
      const { teamA, teamB, totalOvers, batFirstTeam, teamASquad, teamBSquad } =
        JSON.parse(body);

      await client.query("BEGIN");
      try {
        // 1. Create the Match
        const res = await client.query(
          "INSERT INTO matches (team_a_name, team_b_name, total_overs, bat_first_team, status) VALUES ($1, $2, $3, $4, $5) RETURNING id",
          [teamA, teamB, totalOvers, batFirstTeam, "LIVE"],
        );
        const matchId = res.rows[0].id;

        // 2. Create the First Innings
        const battingSquad =
          (batFirstTeam === teamA ? teamASquad : teamBSquad) || [];
        const bowlingSquad =
          (batFirstTeam === teamA ? teamBSquad : teamASquad) || [];

        const innRes = await client.query(
          "INSERT INTO innings (match_id, inning_number, batting_team_name, bowling_team_name) VALUES ($1, $2, $3, $4) RETURNING id",
          [matchId, 1, batFirstTeam, batFirstTeam === teamA ? teamB : teamA],
        );
        const inningId = innRes.rows[0].id;

        // 3. Bulk Initialize Players
        if (battingSquad.length > 0) {
          const playerValues = battingSquad
            .map((_, i) => `($1, $${i + 2})`)
            .join(",");
          await client.query(
            `INSERT INTO players (inning_id, name) VALUES ${playerValues} ON CONFLICT DO NOTHING`,
            [inningId, ...battingSquad],
          );
        }

        // 4. Bulk Initialize Bowlers
        if (bowlingSquad.length > 0) {
          const bowlerValues = bowlingSquad
            .map((_, i) => `($1, $${i + 2})`)
            .join(",");
          await client.query(
            `INSERT INTO bowlers (inning_id, name) VALUES ${bowlerValues} ON CONFLICT DO NOTHING`,
            [inningId, ...bowlingSquad],
          );
        }

        await client.query("COMMIT");

        // 📡 Broadcast new match arrival
        await broadcastHubUpdate(matchId);

        return {
          statusCode: 201,
          body: JSON.stringify({ matchId, inningId }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        };
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    // POST/CREATE A SECOND/NEW INNINGS
    if (httpMethod === "POST" && path.includes("/innings")) {
      const {
        matchId,
        inningNumber,
        battingTeam,
        bowlingTeam,
        target,
        battingSquad,
        bowlingSquad,
      } = JSON.parse(body);

      await client.query("BEGIN");
      try {
        // ✅ Mark innings 1 as completed before creating innings 2
        await client.query(
          `UPDATE innings SET is_completed = TRUE, updated_at = CURRENT_TIMESTAMP
                     WHERE match_id = $1 AND inning_number = $2`,
          [matchId, inningNumber - 1],
        );

        const res = await client.query(
          "INSERT INTO innings (match_id, inning_number, batting_team_name, bowling_team_name, target) VALUES ($1, $2, $3, $4, $5) RETURNING id",
          [matchId, inningNumber, battingTeam, bowlingTeam, target],
        );
        const inningId = res.rows[0].id;

        // Bulk Initialize Players
        if (battingSquad && battingSquad.length > 0) {
          const playerValues = battingSquad
            .map((_, i) => `($1, $${i + 2})`)
            .join(",");
          await client.query(
            `INSERT INTO players (inning_id, name) VALUES ${playerValues} ON CONFLICT DO NOTHING`,
            [inningId, ...battingSquad],
          );
        }
        // Bulk Initialize Bowlers
        if (bowlingSquad && bowlingSquad.length > 0) {
          const bowlerValues = bowlingSquad
            .map((_, i) => `($1, $${i + 2})`)
            .join(",");
          await client.query(
            `INSERT INTO bowlers (inning_id, name) VALUES ${bowlerValues} ON CONFLICT DO NOTHING`,
            [inningId, ...bowlingSquad],
          );
        }

        await client.query("COMMIT");

        // 📡 Notify viewers that innings 2 has started
        await broadcastHubUpdate(matchId);

        return {
          statusCode: 201,
          body: JSON.stringify({ inningId }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        };
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    // GET /matches (All)
    if (httpMethod === "GET" && path === "/matches") {
      // Proactive Cleanup: Auto-complete matches inactive for > 24 hours
      await client.query(
        "UPDATE matches SET status = 'COMPLETED' WHERE status = 'LIVE' AND updated_at < (NOW() - INTERVAL '24 hours')",
      );

      const res = await client.query(`
                SELECT m.*, 
                       (SELECT json_agg(json_build_object(
                           'inning_number', i.inning_number,
                           'batting_team_name', i.batting_team_name,
                           'total_runs', i.total_runs,
                           'total_wickets', i.total_wickets,
                           'overs', i.overs,
                           'balls', i.balls
                       ) ORDER BY i.inning_number) FROM innings i WHERE i.match_id = m.id) as innings
                FROM matches m 
                ORDER BY created_at DESC LIMIT 20
            `);
      return {
        statusCode: 200,
        body: JSON.stringify(res.rows),
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      };
    }

    // GET /match/{matchId} (Summary)
    if (
      httpMethod === "GET" &&
      pathParameters &&
      pathParameters.matchId &&
      !path.includes("/details")
    ) {
      const matchId = pathParameters.matchId;
      const res = await client.query("SELECT * FROM matches WHERE id = $1", [
        matchId,
      ]);
      if (res.rows.length === 0) return { statusCode: 404, body: "Not found" };
      return {
        statusCode: 200,
        body: JSON.stringify(res.rows[0]),
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      };
    }

    // PATCH /match/{matchId} (Update Metadata)
    if (httpMethod === "PATCH" && pathParameters && pathParameters.matchId) {
      const matchId = pathParameters.matchId;
      const { totalOvers, status, matchWinner } = JSON.parse(body);

      const updates = [];
      const params = [matchId];

      if (totalOvers !== undefined) {
        updates.push(`total_overs = $${params.length + 1}`);
        params.push(totalOvers);
      }
      if (status !== undefined) {
        updates.push(`status = $${params.length + 1}`);
        params.push(status);
      }
      if (matchWinner !== undefined) {
        updates.push(`match_winner = $${params.length + 1}`);
        params.push(matchWinner);
      }

      if (updates.length > 0) {
        const query = `UPDATE matches SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`;
        const res = await client.query(query, params);

        // ✅ When match completes, mark all innings as completed and trigger automated report email
        if (status === "COMPLETED") {
          await client.query(
            `UPDATE innings SET is_completed = TRUE, updated_at = CURRENT_TIMESTAMP WHERE match_id = $1`,
            [matchId],
          );
          console.log(
            `✅ All innings for match ${matchId} marked as completed.`,
          );

          // Sync final scores and wickets to matches table columns
          await client.query(
            `
                        UPDATE matches m
                        SET team_a_score = COALESCE((SELECT total_runs FROM innings WHERE match_id = m.id AND batting_team_name = m.team_a_name), 0),
                            team_a_wickets = COALESCE((SELECT total_wickets FROM innings WHERE match_id = m.id AND batting_team_name = m.team_a_name), 0),
                            team_a_overs = COALESCE((SELECT CONCAT(overs, '.', balls) FROM innings WHERE match_id = m.id AND batting_team_name = m.team_a_name), '0.0'),
                            team_b_score = COALESCE((SELECT total_runs FROM innings WHERE match_id = m.id AND batting_team_name = m.team_b_name), 0),
                            team_b_wickets = COALESCE((SELECT total_wickets FROM innings WHERE match_id = m.id AND batting_team_name = m.team_b_name), 0),
                            team_b_overs = COALESCE((SELECT CONCAT(overs, '.', balls) FROM innings WHERE match_id = m.id AND batting_team_name = m.team_b_name), '0.0')
                        WHERE id = $1
                    `,
            [matchId],
          );
          console.log(
            `✅ Synchronized team scores and wickets on matches table for ${matchId}.`,
          );

          // NOTE: Email report is triggered by the frontend via POST /match/{id}/email
          // to avoid double-sending when scorer and admin share the same email.
          console.log(
            `✅ Match ${matchId} completion processed. Frontend will trigger email report.`,
          );
        }

        return {
          statusCode: 200,
          body: JSON.stringify(res.rows[0] || {}),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        };
      }
    }

    // POST /match/{matchId}/email (Send Fancy HTML Email)
    if (
      httpMethod === "POST" &&
      pathParameters &&
      pathParameters.matchId &&
      path.includes("/email")
    ) {
      const matchId = pathParameters.matchId;
      const {
        emailTo,
        origin,
        reportState,
        sendToAdmin = false,
      } = JSON.parse(body);

      try {
        const emailResult = await sendMatchReportEmail(
          matchId,
          emailTo,
          origin,
          reportState,
          client,
          sendToAdmin,
        );
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: "Email dispatch completed",
            adminSent: emailResult.adminEmailSent,
            scorerSent: emailResult.scorerEmailSent,
          }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        };
      } catch (err) {
        console.error("Email dispatch failed:", err);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: err.message }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        };
      }
    }

    // GET /match/{matchId}/details (Full Scorecard Data)
    if (
      httpMethod === "GET" &&
      pathParameters &&
      pathParameters.matchId &&
      path.includes("/details")
    ) {
      const matchId = pathParameters.matchId;

      // 1. Fetch Match Header
      let matchRes;
      try {
        matchRes = await client.query("SELECT * FROM matches WHERE id = $1", [
          matchId,
        ]);
      } catch (dbErr) {
        // Invalid UUID format or other DB errors → treat as not found
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Match not found" }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        };
      }
      if (matchRes.rows.length === 0)
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Match not found" }),
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        };

      // 2. Fetch Innings
      const inningsRes = await client.query(
        "SELECT * FROM innings WHERE match_id = $1 ORDER BY inning_number",
        [matchId],
      );

      const fullDetails = {
        match: matchRes.rows[0],
        innings: [],
      };

      for (const inn of inningsRes.rows) {
        // Fetch Players for this inning
        const playersRes = await client.query(
          "SELECT * FROM players WHERE inning_id = $1 ORDER BY batting_position ASC NULLS LAST, runs DESC",
          [inn.id],
        );
        // Fetch Bowlers for this inning
        const bowlersRes = await client.query(
          "SELECT * FROM bowlers WHERE inning_id = $1",
          [inn.id],
        );
        // Fetch all ball events
        const ballsRes = await client.query(
          "SELECT * FROM ball_events WHERE inning_id = $1 ORDER BY created_at",
          [inn.id],
        );

        fullDetails.innings.push({
          ...inn,
          players: playersRes.rows,
          bowlers: bowlersRes.rows,
          allBalls: ballsRes.rows,
        });
      }

      return {
        statusCode: 200,
        body: JSON.stringify(fullDetails),
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      };
    }
  } catch (error) {
    console.error("Error handling match API:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
      headers: { "Content-Type": "application/json" },
    };
  } finally {
    // Important: In Lambda, frequently connecting/disconnecting is slow.
    // For production, use pooling. For now, closing the client.
    await client.end();
  }
};
