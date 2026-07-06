# 📡 Score Update Lambda

This serverless AWS Lambda function is the **Ingestion Point** for live ball-by-ball scoring events in the CricScore platform.

## Responsibilities

Authorized scorers (umpires or official scorers) submit live match events (runs, wickets, extras) via `POST` requests.

1. **Validation**: Accepts and validates the incoming JSON payload representing a match event.
2. **Fan-Out Publishing**: Instead of writing to the database directly (which could cause latency for the scorer), this Lambda immediately publishes the event payload to an **AWS SNS Topic**.

## Architecture Context

By publishing to SNS, this Lambda enables the **Fan-Out Pattern**. The SNS topic pushes the event to two distinct downstream consumers simultaneously:

- **`broadcaster` Lambda**: For immediate sub-second real-time delivery to WebSocket clients.
- **`storage-worker` SQS Queue**: For asynchronous, reliable, and transactional database persistence.
