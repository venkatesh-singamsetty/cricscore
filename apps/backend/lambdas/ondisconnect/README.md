# 🔌 OnDisconnect Lambda

This serverless AWS Lambda function handles the `$disconnect` route for the CricScore WebSocket API.

## Responsibilities

When a fan closes their browser, loses connection, or navigates away, API Gateway triggers this Lambda.

1. **Connection Cleanup**: Extracts the unique `connectionId` provided by API Gateway.
2. **Persistence**: Deletes the `connectionId` from the DynamoDB Connections Table.

Keeping the DynamoDB table pruned ensures that the `broadcaster` Lambda does not waste time and resources attempting to send live score updates to dead connections.
