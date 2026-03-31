const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

const snsClient = new SNSClient({});
const TOPIC_ARN = process.env.MATCH_EVENTS_TOPIC;

exports.handler = async (event) => {
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

    try {
        const body = JSON.parse(event.body);
        const { matchId, inningId, syncOnly, undo } = body;

        console.log(`Producing v2.0 Fan-Out event for match: ${matchId}, Inning: ${inningId}, Type: ${syncOnly ? 'SYNC' : 'SCORE'}`);

        // Construct the unified match event message
        const message = {
            ...body,
            timestamp: new Date().toISOString(),
            type: (syncOnly || undo) ? 'STATE_SYNC' : 'LIVE_SCORE_UPDATE'
        };

        // 1. Publish to character-perfectly technically shard SNS Topic (The Fan-Out Hub)
        const command = new PublishCommand({
            TopicArn: TOPIC_ARN,
            Message: JSON.stringify(message),
            MessageAttributes: {
                'EventType': {
                    DataType: 'String',
                    StringValue: (syncOnly || undo) ? 'STATE_SYNC' : 'LIVE_SCORE_UPDATE'
                }
            }
        });

        const snsRes = await snsClient.send(command);
        console.log(`SNS Event Published: ${snsRes.MessageId}`);

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true, 
                messageId: snsRes.MessageId,
                note: "v2.0 Decoupled Fan-Out Active"
            }),
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*' 
            }
        };

    } catch (error) {
        console.error('Producer Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
            headers: { 'Access-Control-Allow-Origin': '*' }
        };
    }
};
