# 🔭 Observability & Monitoring

CricScore implements a full-stack, enterprise-grade observability suite that spans from the user's browser down to the database row, all while maintaining a $0/month footprint.

## 1. 📊 Centralized CloudWatch "Mission Control"

Instead of manually digging through dozens of AWS services, the entire application's health is aggregated into a single **CloudWatch Dashboard**.

**Why we configured this:**
AWS requires you to click through multiple different screens to see API Gateway traffic, Lambda errors, and SQS queue depths independently. By using Terraform to stitch all of these metrics into a single "Mission Control" screen, you can instantly see the health of your entire serverless stack in one glance without wasting time navigating the AWS console.

- **Location**: AWS Console ➔ CloudWatch ➔ Dashboards ➔ `cricscore-mission-control`.
- **Metrics Tracked**:
  - Live HTTP and WebSocket API Gateway Traffic.
  - Invocations for all 6 Lambda functions.
  - Error Rates for all Lambda functions.
  - SQS Storage Buffer queue depths (Messages Available vs. Delayed).
- **Automation**: This dashboard is automatically generated and kept up-to-date by the `infra/terraform/dashboard.tf` IaC file.
- **Structured JSON Logging**: All Lambda functions are configured to output strictly structured JSON logs. This enables CloudWatch Log Insights to perform complex SQL-like queries against production errors across all microservices instantly.

## 2. ⚡ AWS X-Ray Distributed Tracing

Because CricScore uses an asynchronous "Fan-Out" architecture, a single user request can trigger multiple AWS services. **AWS X-Ray** visually traces the exact path and latency of these requests.

- **The Free Tier Problem**: AWS only allows 100,000 free traces per month. A busy cricket match would exceed this in a single day.
- **The Sampling Solution**: We enforce a strict **5% Sampling Rule** defined in `infra/terraform/xray.tf`. The system guarantees a maximum of 1 trace per second, and then randomly samples 5% of all traffic after that. This provides excellent statistical visibility into cold starts without ever triggering billing alarms.

## 3. 🛡️ Active Alerting (SNS)

CloudWatch Alarms actively monitor the `match-api` and `score-upd` Lambdas.

- If the error rate for either function exceeds `0` for 5 minutes, an **AWS SNS Notification** is immediately fired.
- This alert sends an emergency email directly to the Administrator's inbox (`SES_SOURCE`).

### 🐛 4. Frontend Crash Reporting (Sentry)

While AWS monitors the backend, **Sentry** monitors the React UI running on the end-user's phone.

**Why we configured this:**
AWS CloudWatch has zero visibility into what happens inside the user's browser. If a fan with an older Android device experiences a JavaScript error that causes the scoreboard to go blank, it fails silently on their device. Sentry intercepts these client-side crashes, records the exact sequence of clicks the user made before the crash, and alerts the developer.

### Setting up Sentry (Free)

If a user experiences a "white screen of death" or a silent JavaScript exception, Sentry automatically uploads the exact line of code to your dashboard.

1. Create a free developer account at [Sentry.io](https://sentry.io/).
2. Create a new "React" project.
3. Sentry will provide you with a **DSN Link** (Data Source Name).
4. Open your `.env.local` or GitHub Actions environment variables and paste the link:
   ```bash
   VITE_SENTRY_DSN=https://your-unique-key@o0.ingest.sentry.io/0
   ```
5. The frontend is already hardcoded to automatically detect this variable and begin transmitting crash reports and session replays.

## 5. ⏱️ Uptime Monitoring (BetterStack / UptimeRobot)

To ensure the `cricscore.venkateshsingamsetty.site` URL is always resolving globally, we highly recommend attaching a free external uptime monitor.

**Why we configured this:**
While AWS Alarms can tell you if your backend code is throwing errors, they cannot tell you if your entire AWS region goes offline, or if your DNS registrar accidentally expires your domain. By using an external 3rd-party pinging service outside of the AWS ecosystem, you guarantee an independent source of truth regarding whether your site is actually online for your fans.

### Recommended Free Setup:

1. Go to [BetterStack (Uptime)](https://betterstack.com/) or [UptimeRobot](https://uptimerobot.com/).
2. Create an **HTTP(s) Monitor**.
3. Point it at your production URL: `https://cricscore.venkateshsingamsetty.site/`
4. Set the ping interval to **3 minutes**.
5. Configure SMS or Email alerts if the site drops connection.

---

© 2026 CricScore Documentation. 🏎️🏁🚀
