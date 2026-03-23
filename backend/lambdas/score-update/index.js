const { Kafka } = require('kafkajs');
const { Client } = require('pg');
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const fs = require('fs');
const path = require('path');

process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';

const lambdaClient = new LambdaClient({});
const BROADCASTER_LAMBDA = process.env.BROADCASTER_LAMBDA;

// Dynamic Certificate Loading (Base64 Env Vars preferred, Fallback to files for local dev)
const getCert = (envName, fileName) => {
    if (process.env[envName]) {
        return Buffer.from(process.env[envName], 'base64').toString('utf-8');
    }
    if (fs.existsSync(path.join(__dirname, fileName))) {
        return fs.readFileSync(path.join(__dirname, fileName));
    }
    return null; // Will fail later if required
};

const caCert = getCert('KAFKA_CA_CERT', 'ca.pem');
const accessCert = getCert('KAFKA_ACCESS_CERT', 'cert.pem');
const accessKey = getCert('KAFKA_ACCESS_KEY', 'key.pem');

const kafka = new Kafka({
    clientId: 'cricscore-producer',
    brokers: (process.env.KAFKA_BROKERS || '').split(','),
    ssl: {
        ca: caCert ? [caCert] : undefined,
        cert: accessCert || undefined,
        key: accessKey || undefined,
        rejectUnauthorized: false
    }
});

const producer = kafka.producer();

exports.handler = async (event) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const { httpMethod } = event || {};
    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
            },
            body: ''
        };
    }
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { 
            matchId, 
            inningId, 
            ballData, 
            strikerName, 
            nonStrikerName, 
            bowlerName, 
            syncOnly, 
            totalOvers: legacyOvers, 
            currentOvers,
            totalBalls: legacyBalls, 
            currentBalls,
            matchTotalOvers,
            bowlerOvers: explicitBowlerOvers, 
            bowlerBalls: explicitBowlerBalls,
            totalRuns: explicitTotalRuns,
            totalWickets: explicitTotalWickets,
            undo // Added for reverting the last ball record
        } = JSON.parse(event.body);

        const explicitOvers = currentOvers !== undefined ? currentOvers : legacyOvers;
        const explicitBalls = currentBalls !== undefined ? currentBalls : legacyBalls;
        
        await client.connect();
        await producer.connect();

        if (undo) {
             // 0. Revert history by fetching AND reverting aggregate stats for the last ball
             const lastBallRes = await client.query(
                 'SELECT * FROM ball_events WHERE inning_id = $1 ORDER BY created_at DESC LIMIT 1',
                 [inningId]
             );

             if (lastBallRes.rows.length > 0) {
                 const ball = lastBallRes.rows[0];

                 // A. Revert Batter Totals
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

                 // B. Revert Bowler Totals
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

                 // C. Delete the ball event
                 await client.query('DELETE FROM ball_events WHERE id = $1', [ball.id]);
             }
        }

        // 1. Update Inning Current State (Active Players & Totals)
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
            [
                strikerName, 
                nonStrikerName, 
                bowlerName, 
                explicitOvers, 
                explicitBalls, 
                explicitTotalRuns, 
                explicitTotalWickets, 
                inningId
            ]
        );

        // Update parent match metadata (failover for standalone metadata patch)
        await client.query(
            `UPDATE matches SET 
                total_overs = COALESCE($2, total_overs), 
                updated_at = CURRENT_TIMESTAMP 
             WHERE id = $1`, 
            [matchId, matchTotalOvers]
        );

        if (!syncOnly && ballData && !undo) {
            // 2. Log Ball Event in Postgres
            const ballRes = await client.query(
                `INSERT INTO ball_events (inning_id, over_number, ball_number, bowler_name, batter_name, runs, is_extra, extra_type, extra_runs, is_wicket, wicket_type, fielder_name, commentary) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
                [inningId, ballData.overNumber, ballData.ballNumber, ballData.bowlerName, ballData.batterName, ballData.runs, ballData.isExtra, ballData.extraType, ballData.extraRuns, ballData.isWicket, ballData.wicketType, ballData.fielderName, ballData.commentary]
            );

            const ballId = ballRes.rows[0].id;

            // 2b. Sync Aggregates to Postgres
            const isWide = ballData.extraType === 'WIDE';
            const isNoBall = ballData.extraType === 'NO_BALL';
            const isBye = ballData.extraType === 'BYE';
            const isLegBye = ballData.extraType === 'LEG_BYE';

            const totalRunsToAdd = ballData.runs + (isWide || isNoBall ? 1 : 0);
            const batterRunsToAdd = (!isWide && !isBye && !isLegBye) ? ballData.runs : 0;
            const bowlerRunsToAdd = (!isBye && !isLegBye) ? totalRunsToAdd : 0;
            const isWicket = ballData.isWicket;
            const isValidBall = !isWide && !isNoBall;

            // A. (REDUNDANT team total UPDATE REMOVED - already handled at top of handler)

            // B. Update Batter Stats
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
                    batterRunsToAdd,
                    isValidBall ? 1 : 0,
                    ballData.runs === 4 ? 1 : 0,
                    ballData.runs === 6 ? 1 : 0,
                    isWicket && ballData.wicketType !== 'RETIRED_HURT',
                    isWicket ? ballData.bowlerName : null,
                    isWicket ? ballData.wicketType : null,
                    ballData.fielderName || null,
                    inningId,
                    ballData.batterName
                ]
            );

            // C. Update Bowler Stats
            const nextBowlerOvers = (explicitBowlerOvers !== undefined) ? explicitBowlerOvers : Math.floor((ballData.overNumber * 6 + ballData.ballNumber) / 6);
            const nextBowlerBalls = (explicitBowlerBalls !== undefined) ? explicitBowlerBalls : ballData.ballNumber % 6;

            await client.query(
                `UPDATE bowlers SET 
                    runs_conceded = runs_conceded + $1, 
                    wickets = wickets + $2,
                    overs_completed = $3,
                    balls = $4
                 WHERE inning_id = $5 AND name = $6`,
                [
                    bowlerRunsToAdd,
                    (isWicket && !['RUN_OUT', 'RETIRED_HURT', 'RETIRED_OUT'].includes(ballData.wicketType)) ? 1 : 0,
                    nextBowlerOvers,
                    nextBowlerBalls,
                    inningId,
                    ballData.bowlerName
                ]
            );
        }

        // 3. Stream to Kafka (Summary update for sync-only, or full ball update)
        const message = {
            ...ballData, // Ball-specific details (must come first)
            matchId,
            inningId,
            type: (syncOnly || undo) ? 'STATE_SYNC' : 'LIVE_SCORE_UPDATE',
            timestamp: new Date().toISOString(),
            strikerName,
            nonStrikerName,
            bowlerName,
            bowlerOvers: explicitBowlerOvers,
            bowlerBalls: explicitBowlerBalls,
            runs: explicitTotalRuns, // Definitive total match runs
            wickets: explicitTotalWickets, // Definitive total match wickets
            matchTotalOvers: matchTotalOvers,
            currentOvers: explicitOvers,
            currentBalls: explicitBalls,
            overs: explicitOvers, // Backwards compat for old clients
            balls: explicitBalls, // Backwards compat for old clients
            undo: undo || false
        };

        await producer.send({
            topic: 'score-updates',
            messages: [{ value: JSON.stringify(message) }],
        });

        // 4. Fast-Path Broadcast Trigger
        const mockKafkaEvent = {
            records: {
                "score-updates-0": [
                    { value: Buffer.from(JSON.stringify(message)).toString('base64') }
                ]
            }
        };

        try {
            await lambdaClient.send(new InvokeCommand({
                FunctionName: BROADCASTER_LAMBDA,
                InvocationType: "Event",
                Payload: JSON.stringify(mockKafkaEvent)
            }));
        } catch (broadCastErr) {
            console.error("Fast-Path Broadcast Trigger failed:", broadCastErr);
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, ballId: ballId }),
            headers: { 'Content-Type': 'application/json' }
        };

    } catch (error) {
        console.error('Error producing score update:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    } finally {
        await client.end();
        await producer.disconnect();
    }
};
