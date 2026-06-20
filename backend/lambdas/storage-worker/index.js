const { Client } = require('pg');

exports.handler = async (event) => {
    // SQS batch source check
    const records = event.Records || [];
    console.log(`Processing batch of ${records.length} events from SQS`);

    const cleanDbUrl = (process.env.DATABASE_URL || '').split('?')[0];
    const client = new Client({
        connectionString: cleanDbUrl,
        // codeql[js/disabling-certificate-validation] Aiven DB requires this unless explicit CA bundle is provided
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        for (const record of records) {
            // Since raw_message_delivery is true on the SQS subscription, 
            // record.body is the actual message payload, not wrapped in SNS metadata
            const matchEvent = JSON.parse(record.body);

            const { 
                matchId, 
                inningId, 
                ballData, 
                strikerName, 
                nonStrikerName, 
                bowlerName, 
                syncOnly, 
                currentOvers,
                currentBalls,
                matchTotalOvers,
                bowlerOvers: explicitBowlerOvers, 
                bowlerBalls: explicitBowlerBalls,
                totalRuns: explicitTotalRuns,
                totalWickets: explicitTotalWickets,
                undo 
            } = matchEvent;

            console.log(`Processing event for match: ${matchId}, type: ${matchEvent.type}`);

            if (undo) {
                 const lastBallRes = await client.query(
                     'SELECT * FROM ball_events WHERE inning_id = $1 ORDER BY created_at DESC LIMIT 1',
                     [inningId]
                 );

                 if (lastBallRes.rows.length > 0) {
                     const ball = lastBallRes.rows[0];
                     const isWide = ball.extra_type === 'WIDE';
                     const isBye = ball.extra_type === 'BYE';
                     const isLegBye = ball.extra_type === 'LEG_BYE';
                     const isNoBall = ball.extra_type === 'NO_BALL';

                     const batterRunsToDeduct = (!isWide && !isBye && !isLegBye) ? ball.runs : 0;
                     const isValidBall = !isWide && !isNoBall;

                     await client.query(
                         `UPDATE players SET 
                             runs = runs - $1, 
                             balls_faced = balls_faced - $2,
                             fours = fours - $3,
                             sixes = sixes - $4,
                             is_out = CASE WHEN $5 THEN false ELSE is_out END,
                             wicket_by = null, wicket_type = null, fielder_name = null
                          WHERE inning_id = $6 AND name = $7`,
                         [
                             batterRunsToDeduct,
                             isValidBall ? 1 : 0,
                             ball.runs === 4 ? 1 : 0,
                             ball.runs === 6 ? 1 : 0,
                             ball.is_wicket,
                             inningId,
                             ball.batter_name
                         ]
                     );

                     const totalRunsInBall = ball.runs + (isWide || isNoBall ? 1 : 0);
                     const bowlerRunsToDeduct = (!isBye && !isLegBye) ? totalRunsInBall : 0;
                     const isBowlerWicket = ball.is_wicket && !['RUN_OUT', 'RETIRED_HURT', 'RETIRED_OUT'].includes(ball.wicket_type);

                     await client.query(
                         `UPDATE bowlers SET 
                             runs_conceded = runs_conceded - $1, 
                             wickets = wickets - $2,
                             overs_completed = $3,
                             balls = $4
                          WHERE inning_id = $5 AND name = $6`,
                         [
                             bowlerRunsToDeduct,
                             isBowlerWicket ? 1 : 0,
                             explicitBowlerOvers, 
                             explicitBowlerBalls,
                             inningId,
                             ball.bowler_name
                         ]
                     );

                     await client.query('DELETE FROM ball_events WHERE id = $1', [ball.id]);
                 }
            }

            // 1. Update Inning Current State
            await client.query(
                `UPDATE innings SET 
                    striker_name = COALESCE($1, striker_name), 
                    non_striker_name = COALESCE($2, non_striker_name), 
                    current_bowler_name = COALESCE($3, current_bowler_name), 
                    overs = COALESCE($4, overs),
                    balls = COALESCE($5, balls),
                    total_runs = COALESCE($6, total_runs),
                    total_wickets = COALESCE($7, total_wickets),
                    updated_at = CURRENT_TIMESTAMP
                 WHERE id = $8`,
                [strikerName, nonStrikerName, bowlerName, currentOvers, currentBalls, explicitTotalRuns, explicitTotalWickets, inningId]
            );

            // 2. Update Match Metadata + Sync Scores, Wickets, and Overs
            await client.query(`
                UPDATE matches m
                SET total_overs = COALESCE($2, total_overs),
                    team_a_score = COALESCE((SELECT total_runs FROM innings WHERE match_id = m.id AND batting_team_name = m.team_a_name), 0),
                    team_a_wickets = COALESCE((SELECT total_wickets FROM innings WHERE match_id = m.id AND batting_team_name = m.team_a_name), 0),
                    team_a_overs = COALESCE((SELECT CONCAT(overs, '.', balls) FROM innings WHERE match_id = m.id AND batting_team_name = m.team_a_name), '0.0'),
                    team_b_score = COALESCE((SELECT total_runs FROM innings WHERE match_id = m.id AND batting_team_name = m.team_b_name), 0),
                    team_b_wickets = COALESCE((SELECT total_wickets FROM innings WHERE match_id = m.id AND batting_team_name = m.team_b_name), 0),
                    team_b_overs = COALESCE((SELECT CONCAT(overs, '.', balls) FROM innings WHERE match_id = m.id AND batting_team_name = m.team_b_name), '0.0'),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [matchId, matchTotalOvers]);

            if (!syncOnly && ballData && !undo) {
                // 3. Log Ball Event
                await client.query(
                    `INSERT INTO ball_events (inning_id, over_number, ball_number, bowler_name, batter_name, runs, is_extra, extra_type, extra_runs, is_wicket, wicket_type, fielder_name, commentary) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                    [inningId, ballData.overNumber, ballData.ballNumber, ballData.bowlerName, ballData.batterName, ballData.runs, ballData.isExtra, ballData.extraType, ballData.extraRuns, ballData.isWicket, ballData.wicketType, ballData.fielderName, ballData.commentary]
                );

                // 4. Update Stats Aggregates
                const isWide = ballData.extraType === 'WIDE';
                const isNoBall = ballData.extraType === 'NO_BALL';
                const isBye = ballData.extraType === 'BYE';
                const isLegBye = ballData.extraType === 'LEG_BYE';

                const totalRunsToAdd = ballData.runs + (isWide || isNoBall ? 1 : 0);
                const batterRunsToAdd = (!isWide && !isBye && !isLegBye) ? ballData.runs : 0;
                const bowlerRunsToAdd = (!isBye && !isLegBye) ? totalRunsToAdd : 0;
                const isWicket = ballData.isWicket;
                const isValidBall = !isWide && !isNoBall;

                // Batter Update
                await client.query(
                    `UPDATE players SET 
                        runs = runs + $1, 
                        balls_faced = balls_faced + $2,
                        fours = fours + $3,
                        sixes = sixes + $4,
                        is_out = $5,
                        wicket_by = $6,
                        wicket_type = $7,
                        fielder_name = $8
                     WHERE inning_id = $9 AND name = $10`,
                    [
                        batterRunsToAdd, isValidBall ? 1 : 0, ballData.runs === 4 ? 1 : 0, ballData.runs === 6 ? 1 : 0,
                        isWicket && ballData.wicketType !== 'RETIRED_HURT',
                        isWicket ? ballData.bowlerName : null, isWicket ? ballData.wicketType : null, ballData.fielderName || null,
                        inningId, ballData.batterName
                    ]
                );

                const isBowlerWicket = isWicket && (
                    (!isNoBall && !isWide && !['RUN_OUT', 'RETIRED_HURT', 'RETIRED_OUT'].includes(ballData.wicketType)) ||
                    (isWide && ['STUMPED', 'HIT_WICKET'].includes(ballData.wicketType))
                );

                // Bowler Update
                await client.query(
                    `UPDATE bowlers SET 
                        runs_conceded = runs_conceded + $1, 
                        wickets = wickets + $2,
                        overs_completed = $3,
                        balls = $4
                     WHERE inning_id = $5 AND name = $6`,
                    [
                        bowlerRunsToAdd, isBowlerWicket ? 1 : 0,
                        explicitBowlerOvers, explicitBowlerBalls, inningId, ballData.bowlerName
                    ]
                );
            }
        }

        return { statusCode: 200, body: JSON.stringify({ success: true }) };

    } catch (error) {
        console.error('Storage Worker Error:', error);
        throw error; // Let SQS retry
    } finally {
        await client.end();
    }
};
