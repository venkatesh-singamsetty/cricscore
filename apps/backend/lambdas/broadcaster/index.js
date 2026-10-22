const {
  DynamoDBClient,
  ScanCommand,
  DeleteItemCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");

const dynamoClient = new DynamoDBClient({});
const TABLE_NAME = process.env.TABLE_NAME;
const WEBSOCKET_URL = process.env.WEBSOCKET_URL;

exports.handler = async (event) => {
  console.log("v2.0 Broadcast Hub Event Received:", JSON.stringify(event));

  const callbackClient = new ApiGatewayManagementApiClient({
    endpoint: WEBSOCKET_URL.replace("wss://", "https://"),
  });

  // 1. Get all active connections
  let connections;
  try {
    const scanResult = await dynamoClient.send(
      new ScanCommand({ TableName: TABLE_NAME }),
    );
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
  if (
    Array.isArray(event.Records) &&
    event.Records.length > 0 &&
    (event.Records[0]?.EventSource === "aws:sns" ||
      event.Records[0]?.eventSource === "aws:sns")
  ) {
    console.log("Source: AWS SNS (Fast-Path)");
    for (const record of event.Records) {
      if (record?.Sns?.Message) {
        try {
          matchEvents.push(JSON.parse(record.Sns.Message));
        } catch (parseErr) {
          matchEvents.push(record.Sns.Message);
        }
      }
    }
  } else if (event.body) {
    try {
      const parsed =
        typeof event.body === "string" ? JSON.parse(event.body) : event.body;
      matchEvents.push(parsed);
    } catch {
      matchEvents.push(event);
    }
  } else {
    console.warn(
      "Unknown event source mapping. Broadcasting raw event as data.",
    );
    matchEvents.push(event); // Fallback for direct testing
  }

  // 3. Global Broadcast
  for (const matchData of matchEvents) {
    const postCalls = connections.map(async (item) => {
      const connectionId = item.connectionId.S;
      try {
        await callbackClient.send(
          new PostToConnectionCommand({
            ConnectionId: connectionId,
            Data: JSON.stringify({
              type: matchData.type || "LIVE_SCORE_UPDATE",
              data: matchData,
            }),
          }),
        );
      } catch (e) {
        if (e.name === "GoneException" || e.$metadata?.httpStatusCode === 410) {
          console.log(`Connection ${connectionId} is gone. Pruning from DB.`);
          try {
            await dynamoClient.send(
              new DeleteItemCommand({
                TableName: TABLE_NAME,
                Key: { connectionId: { S: connectionId } },
              }),
            );
          } catch (pruneErr) {
            console.error(
              `Failed to prune stale connection ${connectionId}:`,
              pruneErr,
            );
          }
        } else {
          console.error(`Error sending to ${connectionId}:`, e);
        }
      }
    });
    await Promise.all(postCalls);
  }

  return { statusCode: 200, body: "Broadcasted (v2.0 Hub)" };
};
