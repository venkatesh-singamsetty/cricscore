# 💾 Storage Worker Lambda

This serverless AWS Lambda function acts as the **Reliable Persistence Consumer** in the CricScore event-driven architecture.

## Responsibilities

It is triggered asynchronously by an **AWS SQS Queue** containing live score events (published via SNS).

1. **Batch Processing**: Processes SQS messages in batches for efficiency.
2. **ACID Transactions**: Persists ball-by-ball events to the **Aiven PostgreSQL** database.
3. **Aggregate Updates**: Updates the active scoreboard aggregates (total runs, wickets, overs).
4. **Undo Handling**: Contains logic to gracefully revert database state if an umpire triggers an "Undo" event for the previous ball.

## Architecture Context

This Lambda represents the "Slow-Path" for reliability. While viewers get their updates instantly from the `broadcaster`, the `storage-worker` takes its time to ensure the relational database is perfectly synchronized and maintains referential integrity, retrying automatically via Dead Letter Queues (DLQs) if the database becomes temporarily unavailable.
