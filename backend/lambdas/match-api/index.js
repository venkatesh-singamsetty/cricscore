const { Client } = require('pg');

exports.handler = async (event) => {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();

        const { path, httpMethod, body, pathParameters } = event;

        // Handle CORS Preflight
        if (httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
                },
                body: ''
            };
        }

        if (httpMethod === 'POST' && path === '/match') {
            const { teamA, teamB, totalOvers, batFirstTeam, teamASquad, teamBSquad } = JSON.parse(body);

            await client.query('BEGIN');
            try {
                // 1. Create the Match
                const res = await client.query(
                    'INSERT INTO matches (team_a_name, team_b_name, total_overs, bat_first_team, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                    [teamA, teamB, totalOvers, batFirstTeam, 'LIVE']
                );
                const matchId = res.rows[0].id;

                // 2. Create the First Innings
                const battingSquad = (batFirstTeam === teamA ? teamASquad : teamBSquad) || [];
                const bowlingSquad = (batFirstTeam === teamA ? teamBSquad : teamASquad) || [];

                const innRes = await client.query(
                    'INSERT INTO innings (match_id, inning_number, batting_team_name, bowling_team_name) VALUES ($1, $2, $3, $4) RETURNING id',
                    [matchId, 1, batFirstTeam, (batFirstTeam === teamA ? teamB : teamA)]
                );
                const inningId = innRes.rows[0].id;

                // 3. Bulk Initialize Players
                if (battingSquad.length > 0) {
                    const playerValues = battingSquad.map((_, i) => `($1, $${i + 2})`).join(',');
                    await client.query(`INSERT INTO players (inning_id, name) VALUES ${playerValues} ON CONFLICT DO NOTHING`, [inningId, ...battingSquad]);
                }

                // 4. Bulk Initialize Bowlers
                if (bowlingSquad.length > 0) {
                    const bowlerValues = bowlingSquad.map((_, i) => `($1, $${i + 2})`).join(',');
                    await client.query(`INSERT INTO bowlers (inning_id, name) VALUES ${bowlerValues} ON CONFLICT DO NOTHING`, [inningId, ...bowlingSquad]);
                }

                await client.query('COMMIT');

                return {
                    statusCode: 201,
                    body: JSON.stringify({ matchId, inningId }),
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                };
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            }
        }

        // POST/CREATE A SECOND/NEW INNINGS
        if (httpMethod === 'POST' && path.includes('/innings')) {
            const { matchId, inningNumber, battingTeam, bowlingTeam, target, battingSquad, bowlingSquad } = JSON.parse(body);

            await client.query('BEGIN');
            try {
                const res = await client.query(
                    'INSERT INTO innings (match_id, inning_number, batting_team_name, bowling_team_name, target) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                    [matchId, inningNumber, battingTeam, bowlingTeam, target]
                );
                const inningId = res.rows[0].id;

                // Bulk Initialize Players
                if (battingSquad && battingSquad.length > 0) {
                    const playerValues = battingSquad.map((_, i) => `($1, $${i + 2})`).join(',');
                    await client.query(`INSERT INTO players (inning_id, name) VALUES ${playerValues} ON CONFLICT DO NOTHING`, [inningId, ...battingSquad]);
                }
                // Bulk Initialize Bowlers
                if (bowlingSquad && bowlingSquad.length > 0) {
                    const bowlerValues = bowlingSquad.map((_, i) => `($1, $${i + 2})`).join(',');
                    await client.query(`INSERT INTO bowlers (inning_id, name) VALUES ${bowlerValues} ON CONFLICT DO NOTHING`, [inningId, ...bowlingSquad]);
                }

                await client.query('COMMIT');

                return {
                    statusCode: 201,
                    body: JSON.stringify({ inningId }),
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                };
            } catch (err) {
                await client.query('ROLLBACK');
                throw err;
            }
        }

        // GET /matches (All)
        if (httpMethod === 'GET' && path === '/matches') {
            const res = await client.query('SELECT * FROM matches ORDER BY created_at DESC LIMIT 20');
            return {
                statusCode: 200,
                body: JSON.stringify(res.rows),
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            };
        }

        // GET /match/{matchId} (Summary)
        if (httpMethod === 'GET' && pathParameters && pathParameters.matchId && !path.includes('/details')) {
            const matchId = pathParameters.matchId;
            const res = await client.query('SELECT * FROM matches WHERE id = $1', [matchId]);
            if (res.rows.length === 0) return { statusCode: 404, body: 'Not found' };
            return {
                statusCode: 200,
                body: JSON.stringify(res.rows[0]),
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            };
        }

        // PATCH /match/{matchId} (Update Metadata)
        if (httpMethod === 'PATCH' && pathParameters && pathParameters.matchId) {
            const matchId = pathParameters.matchId;
            const { totalOvers, status } = JSON.parse(body);
            
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
            
            if (updates.length > 0) {
                const query = `UPDATE matches SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`;
                const res = await client.query(query, params);
                return {
                    statusCode: 200,
                    body: JSON.stringify(res.rows[0] || {}),
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                };
            }
        }

        // GET /match/{matchId}/details (Full Scorecard Data)
        if (httpMethod === 'GET' && pathParameters && pathParameters.matchId && path.includes('/details')) {
            const matchId = pathParameters.matchId;
            
            // 1. Fetch Match Header
            const matchRes = await client.query('SELECT * FROM matches WHERE id = $1', [matchId]);
            if (matchRes.rows.length === 0) return { statusCode: 404, body: 'Match not found' };
            
            // 2. Fetch Innings
            const inningsRes = await client.query('SELECT * FROM innings WHERE match_id = $1 ORDER BY inning_number', [matchId]);
            
            const fullDetails = {
                match: matchRes.rows[0],
                innings: []
            };

            for (const inn of inningsRes.rows) {
                // Fetch Players for this inning
                const playersRes = await client.query('SELECT * FROM players WHERE inning_id = $1', [inn.id]);
                // Fetch Bowlers for this inning
                const bowlersRes = await client.query('SELECT * FROM bowlers WHERE inning_id = $1', [inn.id]);
                // Fetch all ball events
                const ballsRes = await client.query('SELECT * FROM ball_events WHERE inning_id = $1 ORDER BY created_at', [inn.id]);

                fullDetails.innings.push({
                    ...inn,
                    players: playersRes.rows,
                    bowlers: bowlersRes.rows,
                    allBalls: ballsRes.rows
                });
            }

            return {
                statusCode: 200,
                body: JSON.stringify(fullDetails),
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            };
        }

    } catch (error) {
        console.error('Error handling match API:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
            headers: { 'Content-Type': 'application/json' }
        };
    } finally {
        // Important: In Lambda, frequently connecting/disconnecting is slow.
        // For production, use pooling. For now, closing the client.
        await client.end();
    }
};
