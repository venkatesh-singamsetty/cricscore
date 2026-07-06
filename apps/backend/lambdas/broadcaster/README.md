# 📡 Broadcaster Lambda

This serverless AWS Lambda function acts as the **Fast-Path WebSocket Publisher** in the CricScore event-driven architecture.

## Responsibilities

1. **Event Consumption**: Triggered by the main `aws:sns` Fan-Out topic. It receives live score updates instantly when a scorer submits them.
2. **Connection Management**: Queries the DynamoDB WebSocket connection registry to find all currently connected clients (fans).
3. **Real-Time Delivery**: Uses the Amazon API Gateway Management API to push the live JSON payload to every active WebSocket connection.
4. **Stale Connection Pruning**: Automatically catches `GoneException` (410) errors from API Gateway and removes stale/dead connections from DynamoDB to keep the registry clean.

## Architecture Context

This Lambda represents the "Fast-Path" for real-time latency. While the `storage-worker` processes the same events for persistence (ACID), the `broadcaster` immediately pushes data to viewers, achieving sub-second global latency.
