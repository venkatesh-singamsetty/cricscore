const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DeleteItemCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
    console.log("WebSocket Disconnection:", JSON.stringify(event));
    
    const connectionId = event.requestContext.connectionId;

    try {
        const command = new DeleteItemCommand({
            TableName: TABLE_NAME,
            Key: {
                connectionId: { S: connectionId }
            }
        });

        await client.send(command);
        
        return {
            statusCode: 200,
            body: "Disconnected"
        };
    } catch (err) {
        console.error("Error removing connection:", err);
        return {
            statusCode: 500,
            body: "Failed to disconnect: " + JSON.stringify(err)
        };
    }
};
