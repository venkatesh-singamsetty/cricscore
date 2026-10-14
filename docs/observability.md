# 🔭 Observability & Monitoring

CricScore uses AWS and optional external observability services. Actual cost depends on account eligibility, region, configuration, and usage; see [cost_management.md](./cost_management.md).

> [!NOTE]
> The CloudWatch dashboard is not currently provisioned in Terraform. Check current AWS pricing and account eligibility before assuming any observability feature is free.

---

## 1. 📋 CloudWatch Logging

Lambda functions write their standard output and error streams to CloudWatch Logs. The application determines the log message format; not all current messages are structured JSON.

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

## 2. ⚡ AWS X-Ray Distributed Tracing

Because CricScore uses an asynchronous **Fan-Out** architecture, a single user request triggers multiple AWS services. **AWS X-Ray** visually traces the exact path and latency of these requests.

- **Sampling Rule** (`infra/terraform/xray.tf`): The rule uses a 5% fixed sampling rate and a one-request-per-second reservoir. The resulting trace volume depends on traffic and sampling behavior.
- **Lambda tracing**: Active tracing is configured for the ZIP-based Lambda functions and the prediction Lambda.
- **Console**: [X-Ray Service Map](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:service-map/map) | [X-Ray Traces](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:traces/query)

---

## 3. 🛡️ CloudWatch Alarms & SNS Alerts

CloudWatch Alarms actively monitor the critical Lambdas and fire email alerts on failure.

- **Alarms provisioned**: Two CloudWatch alarms are configured. Check current pricing and account eligibility to determine charges.
- **Alarms provisioned** (`infra/terraform/lambda.tf`):
  - `match-api-errors` — fires if Match API Lambda error count > 0 in any 5-minute window.
  - `score-update-errors` — fires if Score Update Lambda error count > 0 in any 5-minute window.
- **Alert delivery**: An SNS topic (`lambda-alerts`) sends an emergency email to the admin (`var.admin_email`) when either alarm triggers.
- **Console**: [CloudWatch Alarms](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#alarmsV2:)

---

## 4. 🐛 Frontend Crash Reporting — Sentry (Optional)

While AWS monitors the backend, **Sentry** monitors the React UI on end-user devices. AWS CloudWatch has zero visibility into browser-side JavaScript crashes.

> [!IMPORTANT]
> Sentry is **optional** and requires manual setup. The frontend code already integrates it — you just need to provide a DSN.

**Setup:**

1. Create a free account at [sentry.io](https://sentry.io/).
2. Create a new **React** project. Sentry will give you a **DSN link**.
3. Add the DSN to your GitHub Actions environment variables (or `.env.local`):
   ```bash
   VITE_SENTRY_DSN=https://your-unique-key@o0.ingest.sentry.io/0
   ```
4. The frontend (`apps/frontend/src/index.tsx`) automatically detects this variable and starts sending crash reports.

---

## 5. ⏱️ Uptime Monitoring — External (Optional)

AWS Alarms can detect backend errors but cannot detect if your entire AWS region goes down or DNS fails. An external uptime monitor provides this independent check.

> [!NOTE]
> This is **not provisioned in Terraform** — it requires a one-time manual setup on a free external service.

Check each provider's current plan limits and pricing:

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

| Resource                 | Monthly Cost    | Decision                                           |
| ------------------------ | --------------- | -------------------------------------------------- |
| **CloudWatch Dashboard** | Not provisioned | Not present in the current Terraform configuration |

Other AWS observability resources may incur charges depending on usage and account eligibility. See [cost_management.md](./cost_management.md) for cost drivers.

---

© 2026 CricScore Documentation. 🏎️🏁🚀
