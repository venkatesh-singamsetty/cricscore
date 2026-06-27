# 🛠️ CricScore AWS & Security Resources Dashboard

This document provides quick-access UI links to view the live AWS resources, telemetry data, and security dashboards for the CricScore platform.

> [!NOTE]
> All links assume you are logged into your AWS Console and your primary region is `us-east-1`.

---

## ⚡ Serverless Compute (AWS Lambda)

Direct links to view the source code, configurations, and test events for the serverless functions:

---

## 📝 Application Logs (CloudWatch Logs)

Direct links to the live execution logs (stdout/stderr) and `console.log()` outputs for troubleshooting:

---

## 📊 Observability & Tracing (AWS X-Ray & Alarms)

AWS X-Ray visualizes the request path between API Gateway, Lambda, and SNS, helping identify latency bottlenecks or 5xx failures.

- [**X-Ray Service Map**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:service-map/map): A visual node-graph of all interacting services.
- [**X-Ray Traces Dashboard**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:traces/query): Detailed timelines of individual HTTP requests.
- [**CloudWatch Alarms Dashboard**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#alarmsV2:): View active alarms for API 5XX errors and Lambda timeouts.

---

## 🌐 Networking & Infrastructure

- [**API Gateways (REST & WebSocket)**](https://us-east-1.console.aws.amazon.com/apigateway/main/apis?region=us-east-1): Manage custom domains and throttling.
- [**SNS Topics (Pub/Sub)**](https://us-east-1.console.aws.amazon.com/sns/v3/home?region=us-east-1#/topics): View the event buses that decouple your microservices.
- [**SQS Queues (DLQ)**](https://us-east-1.console.aws.amazon.com/sqs/v3/home?region=us-east-1#/queues): View the Dead-Letter Queues capturing failed events.
- [**DynamoDB Tables**](https://us-east-1.console.aws.amazon.com/dynamodbv2/home?region=us-east-1#tables): View NoSQL state and live caching data.
- [**Aiven PostgreSQL Console**](https://console.aiven.io/): Access the managed relational database.
- [**S3 Buckets**](https://s3.console.aws.amazon.com/s3/buckets?region=us-east-1): Frontend static hosting assets.
- [**CloudFront Distributions**](https://us-east-1.console.aws.amazon.com/cloudfront/v4/home?region=us-east-1#/distributions): Global CDN caching configurations.

---

## 🛡️ Security Posture & Vulnerability Scanners

CricScore utilizes a strict DevSecOps pipeline. To view the results of the automated security tools:

### GitHub Native Dashboards

- [**CodeQL & Checkov Alerts**](https://github.com/venkatesh-singamsetty/cricscore/security/code-scanning): View static application security testing results (e.g., detected SQL injection, XSS) and Terraform misconfigurations (Checkov issues).
- [**Dependabot SCA Alerts**](https://github.com/venkatesh-singamsetty/cricscore/security/dependabot): View known vulnerabilities in third-party NPM dependencies.

### CI/CD Pipeline Scanners (View in GitHub Actions Logs)

The following tools block Pull Requests automatically. You can click these direct links to view the specific workflows running these tools:

- [**GitLeaks**](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/secrets.yml): Detects hardcoded secrets or AWS keys before code is pushed.
- [**CodeQL SAST**](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/codeql.yml): Native static application security testing to detect vulnerabilities like XSS and SQL injection.
- [**Trivy & Checkov**](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/backend-infra.yml): Runs inside the Backend infrastructure pipeline to scan dependencies for CRITICAL/HIGH CVEs (Trivy) and audit Terraform misconfigurations (Checkov).
- [**Syft (SBOM)**](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/sbom.yml): Automatically generates a Software Bill of Materials (available as a downloadable artifact `spdx-json` on the pipeline run page).
- [**OWASP ZAP (DAST)**](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/dast.yml): Runs an active baseline scan against the live deployed API Gateway URLs to detect runtime misconfigurations like missing HTTP headers.

---

## 📋 Project Management & Issue Tracking

- [**Open GitHub Issues**](https://github.com/venkatesh-singamsetty/cricscore/issues?q=is%3Aissue+is%3Aopen): View the active queue of pending bugs, requested features, and ongoing tasks. Tracking open issues helps developers understand current system limitations, prioritize upcoming architecture changes, and manage active security remediation efforts.
