# 🔌 OnConnect Lambda

This serverless AWS Lambda function handles the `$connect` route for the CricScore WebSocket API.

## Responsibilities

When a fan opens the CricScore web application and establishes a WebSocket connection, API Gateway triggers this Lambda.

1. **Connection Registration**: Extracts the unique `connectionId` provided by API Gateway.
2. **Persistence**: Saves the `connectionId` to the DynamoDB Connections Table.

This centralized registry is later queried by the `broadcaster` Lambda to know exactly which clients should receive live score updates.
