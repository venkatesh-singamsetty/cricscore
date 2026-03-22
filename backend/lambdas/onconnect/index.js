const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutItemCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
    console.log("WebSocket Connection Request:", JSON.stringify(event));
    
    const connectionId = event.requestContext.connectionId;

    try {
        const command = new PutItemCommand({
            TableName: TABLE_NAME,
            Item: {
                connectionId: { S: connectionId },
                timestamp: { N: Date.now().toString() }
            }
        });

        await client.send(command);
        
        return {
            statusCode: 200,
            body: "Connected"
        };
    } catch (err) {
        console.error("Error saving connection:", err);
        return {
            statusCode: 500,
            body: "Failed to connect: " + JSON.stringify(err)
        };
    }
};
