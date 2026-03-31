const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");

const dynamoClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
const WEBSOCKET_URL = process.env.WEBSOCKET_URL;

exports.handler = async (event) => {
    console.log("v2.0 Broadcast Hub Event Received:", JSON.stringify(event));

    const callbackClient = new ApiGatewayManagementApiClient({
        endpoint: WEBSOCKET_URL.replace("wss://", "https://")
    });

    // 1. Get all active connections
    let connections;
    try {
        const scanResult = await dynamoClient.send(new ScanCommand({ TableName: TABLE_NAME }));
        connections = scanResult.Items || [];
    } catch (err) {
        console.error("Error scanning connections:", err);
        return;
    }

    if (connections.length === 0) {
        console.log("No active connections found.");
        return;
    }

    // 2. Identify Event Source & Extract Match Data
    let matchEvents = [];

    // CASE A: SNS Event (v2.0 Fast-Path)
    if (event.Records && event.Records[0].EventSource === 'aws:sns') {
        console.log("Source: AWS SNS (Fast-Path)");
        for (const record of event.Records) {
            matchEvents.push(JSON.parse(record.Sns.Message));
        }
    } 
    // CASE B: Kafka Event (Legacy or SQS/Kafka trigger)
    else if (event.records) {
        console.log("Source: Kafka/Legacy Sink");
        const records = event.records;
        for (const key in records) {
            for (const record of records[key]) {
                 const payload = Buffer.from(record.value, 'base64').toString('utf8');
                 matchEvents.push(JSON.parse(payload));
            }
        }
    } else {
        console.warn("Unknown event source mapping. Broadcasting raw event as data.");
        matchEvents.push(event); // Fallback for direct testing
    }

    // 3. Global Broadcast
    for (const matchData of matchEvents) {
        const postCalls = connections.map(async (item) => {
            const connectionId = item.connectionId.S;
            try {
                await callbackClient.send(new PostToConnectionCommand({
                    ConnectionId: connectionId,
                    Data: JSON.stringify({
                        type: matchData.type || "LIVE_SCORE_UPDATE",
                        data: matchData
                    })
                }));
            } catch (e) {
                if (e.name === "GoneException") {
                    console.log(`Connection ${connectionId} is gone.`);
                } else {
                    console.error(`Error sending to ${connectionId}:`, e);
                }
            }
        });
        await Promise.all(postCalls);
    }

    return { statusCode: 200, body: "Broadcasted (v2.0 Hub)" };
};
