# 🔭 Observability & Monitoring

CricScore implements a full-stack observability suite spanning from the user's browser down to the database row, all while maintaining a **$0/month footprint**.

> [!NOTE]
> The CloudWatch Mission Control Dashboard was intentionally removed to eliminate the **$3/month** charge.
> All observability below is within the AWS Free Tier. See [cost_management.md](./cost_management.md) for details.

---

## 1. 📋 Structured CloudWatch Logging (Free)

All Lambda functions are configured to output **strictly structured JSON logs** to CloudWatch Logs automatically (no extra configuration needed — AWS does this natively for Lambda).

- **Free Tier**: 5GB ingestion + 5GB storage per month. At dev/tournament scale: **$0/month**.
- **What's logged**: Every Lambda invocation, error, duration, and cold start is streamed automatically.
- **Log Groups**: One log group per Lambda, e.g. `/aws/lambda/cricscoredev-match-api`.
- **Log Insights**: You can run SQL-like queries across all Lambda logs from the [CloudWatch Log Groups console](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups).

**Example query to find all errors across all functions:**

```sql
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 50
```

---

## 2. ⚡ AWS X-Ray Distributed Tracing (Free)

Because CricScore uses an asynchronous **Fan-Out** architecture, a single user request triggers multiple AWS services. **AWS X-Ray** visually traces the exact path and latency of these requests.

- **Free Tier**: 100,000 traces per month free.
- **Sampling Rule** (`infra/terraform/xray.tf`): Strict **5% sampling** + max 1 trace/second guaranteed. At 1,000,000 requests/month, only ~50,000 traces are recorded — staying within the free tier.
- **Active on all 8 Lambdas**: `tracing_config { mode = "Active" }` is set on every Lambda function.
- **Console**: [X-Ray Service Map](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:service-map/map) | [X-Ray Traces](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:traces/query)

---

## 3. 🛡️ CloudWatch Alarms & SNS Alerts (Free)

CloudWatch Alarms actively monitor the critical Lambdas and fire email alerts on failure.

- **Free Tier**: First **10 alarms** per month are free. We use 2. **$0/month**.
- **Alarms provisioned** (`infra/terraform/lambda.tf`):
  - `match-api-errors` — fires if Match API Lambda error count > 0 in any 5-minute window.
  - `score-update-errors` — fires if Score Update Lambda error count > 0 in any 5-minute window.
- **Alert delivery**: An SNS topic (`lambda-alerts`) sends an emergency email to the admin (`var.admin_email`) when either alarm triggers.
- **Console**: [CloudWatch Alarms](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#alarmsV2:)

---

## 4. 🐛 Frontend Crash Reporting — Sentry (Optional, Free)

While AWS monitors the backend, **Sentry** monitors the React UI on end-user devices. AWS CloudWatch has zero visibility into browser-side JavaScript crashes.

> [!IMPORTANT]
> Sentry is **optional** and requires manual setup. The frontend code already integrates it — you just need to provide a DSN.

**Setup (Free tier — 5,000 errors/month):**

1. Create a free account at [sentry.io](https://sentry.io/).
2. Create a new **React** project. Sentry will give you a **DSN link**.
3. Add the DSN to your GitHub Actions environment variables (or `.env.local`):
   ```bash
   VITE_SENTRY_DSN=https://your-unique-key@o0.ingest.sentry.io/0
   ```
4. The frontend (`apps/frontend/src/index.tsx`) automatically detects this variable and starts sending crash reports.

---

## 5. ⏱️ Uptime Monitoring — External (Optional, Free)

AWS Alarms can detect backend errors but cannot detect if your entire AWS region goes down or DNS fails. An external uptime monitor provides this independent check.

> [!NOTE]
> This is **not provisioned in Terraform** — it requires a one-time manual setup on a free external service.

**Recommended free options:**

- [UptimeRobot](https://uptimerobot.com/) — free for up to 50 monitors, 5-minute intervals.
- [BetterStack Uptime](https://betterstack.com/better-uptime) — free tier with 3-minute intervals.

**Setup (2 minutes):**

1. Create a free account on either service.
2. Add a new **HTTP(s) Monitor** pointing to your production URL:
   - `https://cricscore.venkateshsingamsetty.com`
3. Set ping interval to **3–5 minutes**.
4. Configure email/SMS alerts on downtime.

---

## 💸 What Was Removed & Why

| Resource                                  | Monthly Cost    | Decision                                                   |
| ----------------------------------------- | --------------- | ---------------------------------------------------------- |
| **CloudWatch Dashboard** (`dashboard.tf`) | **$3.00/month** | ❌ Removed — no free tier, not worth the cost at dev scale |

All other observability resources above are within AWS free tier limits. See [cost_management.md](./cost_management.md) for full cost breakdown.

---

© 2026 CricScore Documentation. 🏎️🏁🚀
