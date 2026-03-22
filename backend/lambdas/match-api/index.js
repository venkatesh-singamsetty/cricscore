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

        if (httpMethod === 'POST' && path === '/match') {
            const { teamAName, teamBName, totalOvers, batFirstTeam } = JSON.parse(body);

            const res = await client.query(
                'INSERT INTO matches (team_a_name, team_b_name, total_overs, bat_first_team, status) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [teamAName, teamBName, totalOvers, batFirstTeam, 'SETUP']
            );

            return {
                statusCode: 201,
                body: JSON.stringify({ matchId: res.rows[0].id }),
                headers: { 'Content-Type': 'application/json' }
            };
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

        // GET /match/{matchId} (Single)
        if (httpMethod === 'GET' && pathParameters && pathParameters.matchId) {
            const matchId = pathParameters.matchId;
            const res = await client.query('SELECT * FROM matches WHERE id = $1', [matchId]);
            if (res.rows.length === 0) return { statusCode: 404, body: 'Not found' };
            return {
                statusCode: 200,
                body: JSON.stringify(res.rows[0]),
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
