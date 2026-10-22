# 🔭 Observability & Monitoring Suite

CricScore combines zero-cost AWS telemetry (CloudWatch Logs, CloudWatch Metric Alarms, AWS X-Ray, and AWS Budgets) with optional client-side and edge monitoring (Sentry and UptimeRobot/BetterStack). For cost breakdown and free-tier guardrails, see [cost_management.md](./cost_management.md) and the auto-generated [aws_resources_dashboard.md](./aws_resources_dashboard.md).

---

## 🔄 End-to-End Telemetry & Alerting Flow

```mermaid
flowchart LR
    subgraph ClientAndEdge ["1. Browser & Edge"]
        SPA["React SPA (Scorer / Viewer / Admin)"]
        Sentry["Sentry SDK (Optional Browser Crash Reporting)"]
        Uptime["External Uptime Monitor (HTTPS Ping Every 3-5m)"]
    end

    subgraph Serverless ["2. AWS Serverless Compute (9 Lambdas)"]
        Critical["Critical Path Lambdas (match-api, score-upd)"]
        Workers["Fan-Out & AI/ML Lambdas (broadcaster, storage-worker, chat-api, ml-predict, WS/Auth)"]
    end

    subgraph AWSObservability ["3. AWS Telemetry & Alerting"]
        CWLogs["CloudWatch Log Groups (7-Day Retention)"]
        XRay["AWS X-Ray Tracer (1 req/s reservoir + 5% rate)"]
        Alarms["CloudWatch Metric Alarms (match-api-errors, score-update-errors)"]
        SNSAlert{{"AWS SNS Topic (lambda-alerts)"}}
        Email(["Admin Email Alert (var.admin_email)"])
    end

    SPA -.->|"Unhandled JS exceptions"| Sentry
    Uptime -.->|"Health check"| SPA

    Critical & Workers -->|"stdout / stderr"| CWLogs
    Critical & Workers -.->|"Active tracing segments"| XRay
    Critical -->|"Errors > 0 in 5m"| Alarms
    Alarms --> SNSAlert --> Email
```

---

## 1. 📋 CloudWatch Logging (7-Day Retention)

Every Lambda function streams its `stdout` and `stderr` to a dedicated CloudWatch Log Group with a strict **7-day retention policy** (`retention_in_days = 7` in `infra/terraform/modules/zip_lambda/main.tf`) to prevent log storage cost creep.

### Complete Lambda Log Group Inventory

Replace `<prefix>` with `cricscoredev` (Dev) or `cricscore` (Prod):

| Log Group                                | Source Lambda       | Key Events Logged                                                                   | Quick CLI Tail Command                                                     |
| :--------------------------------------- | :------------------ | :---------------------------------------------------------------------------------- | :------------------------------------------------------------------------- |
| `/aws/lambda/<prefix>-match-api`         | `match-api`         | Match creation, 2nd-innings upsert, completion sync, SES email, admin purges        | `aws logs tail /aws/lambda/cricscoredev-match-api --follow --format short` |
| `/aws/lambda/<prefix>-score-upd`         | `score-upd`         | `STATE_SYNC` & `LIVE_SCORE_UPDATE` SNS publish IDs and SQS FIFO message IDs         | `aws logs tail /aws/lambda/cricscoredev-score-upd --follow --format short` |
| `/aws/lambda/<prefix>-storage-worker`    | `storage-worker`    | SQS FIFO ball persistence, `explicitTotalRuns` updates, `undo: true` rollbacks      | `aws logs tail /aws/lambda/cricscoredev-storage-worker --follow`           |
| `/aws/lambda/<prefix>-broadcaster`       | `broadcaster`       | DynamoDB connection count, WebSocket fan-out delivery, stale socket cleanup (`410`) | `aws logs tail /aws/lambda/cricscoredev-broadcaster --follow`              |
| `/aws/lambda/<prefix>-chat-api`          | `chat-api`          | Agentic RAG queries, MCP tool calls (`execute_sql`, `search_rules`), AI summaries   | `aws logs tail /aws/lambda/cricscoredev-chat-api --follow`                 |
| `/aws/lambda/<prefix>-ml-predict`        | `ml-predict`        | Hybrid Markov DP + DLS + Scikit-Learn win-probability inference requests            | `aws logs tail /aws/lambda/cricscoredev-ml-predict --follow`               |
| `/aws/lambda/<prefix>-onconnect`         | `onconnect`         | New spectator WebSocket `connectionId` registration                                 | `aws logs tail /aws/lambda/cricscoredev-onconnect --follow`                |
| `/aws/lambda/<prefix>-ondisconnect`      | `ondisconnect`      | Disconnected spectator WebSocket `connectionId` removal                             | `aws logs tail /aws/lambda/cricscoredev-ondisconnect --follow`             |
| `/aws/lambda/<prefix>-cognito-presignup` | `cognito-presignup` | Guest (`guest-*@cricscore.local`) auto-confirmation vs. standard user sign-up       | `aws logs tail /aws/lambda/cricscoredev-cognito-presignup --follow`        |

### Useful CloudWatch Logs Insights Queries

Run these in the [CloudWatch Logs Insights console](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:logs-insights):

**1. Find all errors or exceptions across selected Lambda log groups:**

```sql
fields @timestamp, @logStream, @message
| filter @message like /(?i)(ERROR|Exception|Task timed out)/
| sort @timestamp desc
| limit 50
```

**2. Inspect p50, p95, and p99 Lambda latency and cold-start overhead:**

```sql
filter @type = "REPORT"
| stats count(*) as invocations,
        pct(@duration, 50) as p50_ms,
        pct(@duration, 95) as p95_ms,
        pct(@duration, 99) as p99_ms,
        count(@initDuration) as cold_starts
  by bin(5m)
```

---

## 2. ⚡ AWS X-Ray Distributed Tracing

Because CricScore uses an asynchronous **Fan-Out** architecture (`score-upd` $\rightarrow$ SNS $\rightarrow$ `broadcaster` and `score-upd` $\rightarrow$ SQS FIFO $\rightarrow$ `storage-worker`), a single ball scored spans multiple AWS services. **AWS X-Ray** visually maps the service graph and per-hop latency.

- **Sampling Rule** (`infra/terraform/xray.tf`): Configured with a **1 request/second reservoir** and a **5% fixed sampling rate** (`fixed_rate = 0.05`) to stay comfortably within the 100,000 free monthly traces.
- **Active Tracing**: Enabled on all ZIP-based Node.js Lambdas (`modules/zip_lambda`) and the containerized `ml-predict` Lambda (`tracing_config { mode = "Active" }`).
- **Console**: [X-Ray Service Map](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:service-map/map) | [X-Ray Traces](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:traces/query)

---

## 3. 🛡️ CloudWatch Alarms & SNS Email Alerts

CloudWatch Metric Alarms actively monitor the two highest-priority ingestion Lambdas (`infra/terraform/lambda.tf`) and fire real-time email alerts via SNS:

| Alarm Name                      | Monitored Function    | Metric & Window                     | Threshold    | Action                                           |
| :------------------------------ | :-------------------- | :---------------------------------- | :----------- | :----------------------------------------------- |
| `<project>-match-api-errors`    | `<project>-match-api` | `AWS/Lambda Errors` (`Sum`, `300s`) | `> 0 errors` | Publishes alert to `<project>-lambda-alerts` SNS |
| `<project>-score-update-errors` | `<project>-score-upd` | `AWS/Lambda Errors` (`Sum`, `300s`) | `> 0 errors` | Publishes alert to `<project>-lambda-alerts` SNS |

- **Alert Delivery**: `<project>-lambda-alerts` SNS topic sends an immediate notification email to `var.admin_email`.
- **Billing Alert (`infra/terraform/budgets.tf`)**: In addition to operational error alarms, AWS Budgets monitors monthly spend and emails `var.admin_email` if actual costs reach **$5.00/month**.
- **Console**: [CloudWatch Alarms](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#alarmsV2:)

---

## 4. 🐛 Frontend Crash Reporting — Sentry (Optional)

While AWS CloudWatch monitors all backend Lambdas, **Sentry** captures unhandled React exceptions and network failures on end-user mobile/desktop browsers.

> [!IMPORTANT]
> Sentry is **optional** and requires no code changes—`apps/frontend/src/index.tsx` automatically initializes Sentry whenever `VITE_SENTRY_DSN` is present.

**Setup:**

1. Create a free account at [sentry.io](https://sentry.io/) and create a **React** project to obtain your **DSN**.
2. Set `VITE_SENTRY_DSN` in `apps/frontend/.env` (or in your GitHub Environment variables):
   ```bash
   VITE_SENTRY_DSN=https://your-unique-key@o0.ingest.sentry.io/0
   ```

---

## 5. ⏱️ External Uptime Monitoring (Optional)

CloudWatch Alarms detect Lambda execution errors, whereas an external uptime monitor independently verifies DNS resolution, ACM TLS certificates, and CloudFront edge availability from outside AWS:

- [UptimeRobot](https://uptimerobot.com/) — Free tier supports up to 50 HTTP(s) monitors at 5-minute intervals.
- [BetterStack Uptime](https://betterstack.com/better-uptime) — Free tier supports 3-minute HTTP(s) checks with status pages.

**Recommended Monitors:**

1. **Frontend CDN**: `https://cricscore.venkateshsingamsetty.com` (and `https://cricscoredev.venkateshsingamsetty.com` for Dev)
2. **REST API Health**: `https://api.cricscore.venkateshsingamsetty.com/matches` (expects `HTTP 200` JSON array)

---

## 💸 Cost-First Observability Decisions

| Resource                          | Monthly Cost     | Engineering Decision                                                                                                                                    |
| :-------------------------------- | :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **CloudWatch Dashboard**          | $3.00/dashboard  | **Not provisioned in Terraform.** Replaced by auto-generated [aws_resources_dashboard.md](./aws_resources_dashboard.md) with direct console deep-links. |
| **CloudWatch Log Retention**      | $0.03/GB/month   | **Capped at 7 days (`retention_in_days = 7`)** on every Lambda log group to keep storage within free tier.                                              |
| **CloudWatch Metric Alarms (2x)** | $0.00 (≤10 free) | Provisioned only for `match-api` and `score-upd` critical paths.                                                                                        |
| **AWS X-Ray Tracing**             | $0.00 (≤100k/mo) | Throttled to 1 req/sec reservoir + 5% sampling rate (`infra/terraform/xray.tf`).                                                                        |

---

© 2026 CricScore Documentation. 🏎️🏁🚀
