const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require("@aws-sdk/client-apigatewaymanagementapi");

const dynamoClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
const WEBSOCKET_URL = process.env.WEBSOCKET_URL;

// AWS Lambda handles the Kafka polling when using Event Source Mapping.
// The event object will contain the Kafka messages.
exports.handler = async (event) => {
    console.log("Kafka Event Received:", JSON.stringify(event));

    // Initialize the WebSocket callback client
    const callbackClient = new ApiGatewayManagementApiClient({
        endpoint: WEBSOCKET_URL.replace("wss://", "https://")
    });

    // 1. Get all active connections from DynamoDB
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

    // 2. Process each Kafka message (AWS passes them in a specific format for Self-Managed Kafka)
    // event.records is a map where keys are topic-partition and value is array of records
    const records = event.records || {};
    
    for (const key in records) {
        for (const record of records[key]) {
            // record.value is base64 encoded by AWS
            const payloadString = Buffer.from(record.value, 'base64').toString('utf8');
            const ballData = JSON.parse(payloadString);
            
            console.log("Broadcasting ball data:", ballData);

            // 3. Broadcast to each connection
            const postCalls = connections.map(async (item) => {
                const connectionId = item.connectionId.S;
                try {
                    await callbackClient.send(new PostToConnectionCommand({
                        ConnectionId: connectionId,
                        Data: JSON.stringify({
                            type: "LIVE_SCORE_UPDATE",
                            data: ballData
                        })
                    }));
                } catch (e) {
                    if (e.name === "GoneException") {
                        console.log(`Connection ${connectionId} is gone.`);
                    } else {
                        console.error(`Error sending message to ${connectionId}:`, e);
                    }
                }
            });

            await Promise.all(postCalls);
        }
    }

    return { statusCode: 200, body: "Broadcasted" };
};
