# 🏏 Match API Lambda

This serverless AWS Lambda function serves as the **Core REST Backend** for CricScore's match management.

## Responsibilities

It handles all CRUD operations and match lifecycle events via the `GET`, `POST`, `PATCH`, and `DELETE` HTTP methods exposed by API Gateway.

- **Match Initialization**: Create new matches, assign teams, and set up toss details.
- **Match State**: Fetch active match metadata, scorecards, and historical ball-by-ball logs.
- **Tournament Management**: Manage tournament settings and rules.
- **Lifecycle Updates**: Mark innings as complete, finalize matches, and trigger downstream reporting events.

## Database Integration

This Lambda connects directly to the **Aiven PostgreSQL** database. It uses the connection pool configured in the shared `config` and respects the `DB_SCHEMA` environment variable for isolated Dev/Prod data environments.
