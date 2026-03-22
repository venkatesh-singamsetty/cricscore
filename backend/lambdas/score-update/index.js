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
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const { matchId, inningId, ballData } = JSON.parse(event.body);
        
        await client.connect();
        await producer.connect();

        // 1. Log Ball Event in Postgres
        const ballRes = await client.query(
            `INSERT INTO ball_events (inning_id, over_number, ball_number, bowler_name, batter_name, runs, is_extra, extra_type, extra_runs, is_wicket, wicket_type, fielder_name, commentary) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
            [inningId, ballData.overNumber, ballData.ballNumber, ballData.bowlerName, ballData.batterName, ballData.runs, ballData.isExtra, ballData.extraType, ballData.extraRuns, ballData.isWicket, ballData.wicketType, ballData.fielderName, ballData.commentary]
        );

        const ballId = ballRes.rows[0].id;

        // 2. Stream to Kafka
        const message = {
            matchId,
            inningId,
            ballId: ballId,
            timestamp: new Date().toISOString(),
            ...ballData
        };

        await producer.send({
            topic: 'score-updates',
            messages: [{ value: JSON.stringify(message) }],
        });

        // 3. Fast-Path Broadcast Trigger
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
