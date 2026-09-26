# 🛠️ CricScore AWS & Security Resources Dashboard

This document provides quick-access UI links to view the live AWS resources, telemetry data, and security dashboards for the CricScore platform.

> [!NOTE]
> All links assume you are logged into your AWS Console and your primary region is `us-east-1`.

---

## 🟢 Development (DEV)

### Application Endpoints

- **Frontend App**: [https://cricscoredev.venkateshsingamsetty.com](https://cricscoredev.venkateshsingamsetty.com)
- **HTTP API Gateway**: `https://api.cricscoredev.venkateshsingamsetty.com`
- **WebSocket API**: `wss://ws.cricscoredev.venkateshsingamsetty.com`

### Serverless Compute (AWS Lambda)

- [**broadcaster**](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-broadcaster)
- [**chat-api**](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-chat-api)
- [**cognito-presignup**](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-cognito-presignup)
- [**match-api**](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-match-api)
- [**onconnect**](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-onconnect)
- [**ondisconnect**](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-ondisconnect)
- [**score-upd**](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-score-upd)
- [**storage-worker**](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscoredev-storage-worker)

### Application Logs (CloudWatch Logs)

- [**broadcaster Logs**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-broadcaster)
- [**chat-api Logs**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-chat-api)
- [**cognito-presignup Logs**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-cognito-presignup)
- [**match-api Logs**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-match-api)
- [**onconnect Logs**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-onconnect)
- [**ondisconnect Logs**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-ondisconnect)
- [**score-upd Logs**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-score-upd)
- [**storage-worker Logs**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscoredev-storage-worker)

---

## 🔵 Production (PROD)

### Application Endpoints

- **Frontend App**: [https://cricscore.venkateshsingamsetty.com](https://cricscore.venkateshsingamsetty.com)
- **HTTP API Gateway**: `https://api.cricscore.venkateshsingamsetty.com`
- **WebSocket API**: `wss://ws.cricscore.venkateshsingamsetty.com`

### Serverless Compute (AWS Lambda)

- [**broadcaster**](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-broadcaster)
- [**chat-api**](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-chat-api)
- [**cognito-presignup**](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-cognito-presignup)
- [**match-api**](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-match-api)
- [**onconnect**](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-onconnect)
- [**ondisconnect**](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-ondisconnect)
- [**score-upd**](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-score-upd)
- [**storage-worker**](https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/cricscore-storage-worker)

### Application Logs (CloudWatch Logs)

- [**broadcaster Logs**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-broadcaster)
- [**chat-api Logs**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-chat-api)
- [**cognito-presignup Logs**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-cognito-presignup)
- [**match-api Logs**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-match-api)
- [**onconnect Logs**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-onconnect)
- [**ondisconnect Logs**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-ondisconnect)
- [**score-upd Logs**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-score-upd)
- [**storage-worker Logs**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Faws$252Flambda$252Fcricscore-storage-worker)

---

## 📊 Observability & Tracing (AWS X-Ray & Alarms)

AWS X-Ray visualizes the request path between API Gateway, Lambda, and SNS, helping identify latency bottlenecks or 5xx failures.

- [**CloudWatch Log Groups**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups): Structured JSON logs for all Lambda functions.
- [**CloudWatch Metrics**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#metricsV2): View API traffic, Lambda invocations, and SQS queue depths individually (free alternative to a paid dashboard).
- [**X-Ray Service Map**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:service-map/map): A visual node-graph of all interacting services.
- [**X-Ray Traces Dashboard**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:traces/query): Detailed timelines of individual HTTP requests.
- [**CloudWatch Alarms Dashboard**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#alarmsV2:): View active alarms for Match API and Score Update Lambda errors.

---

## 🌐 Networking & Infrastructure

- [**Cognito User Pools (SSO)**](https://us-east-1.console.aws.amazon.com/cognito/v2/idp/user-pools?region=us-east-1): Manage users, admins, and guest accounts.
- [**API Gateways (REST & WebSocket)**](https://us-east-1.console.aws.amazon.com/apigateway/main/apis?region=us-east-1): Manage custom domains and throttling.
- [**Route 53 (DNS)**](https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones): Domain names and routing configurations.
- [**ACM (Certificate Manager)**](https://us-east-1.console.aws.amazon.com/acm/home?region=us-east-1#/certificates): SSL/TLS certificates for API and Frontend custom domains.
- [**SNS Topics (Pub/Sub)**](https://us-east-1.console.aws.amazon.com/sns/v3/home?region=us-east-1#/topics): View the event buses that decouple your microservices.
- [**SQS Queues (DLQ)**](https://us-east-1.console.aws.amazon.com/sqs/v3/home?region=us-east-1#/queues): View the Dead-Letter Queues capturing failed events.
- [**DynamoDB Tables**](https://us-east-1.console.aws.amazon.com/dynamodbv2/home?region=us-east-1#tables): View NoSQL state and live caching data.
- [**Aiven PostgreSQL Console**](https://console.aiven.io/): Access the managed relational database.
- [**S3 Buckets**](https://s3.console.aws.amazon.com/s3/buckets?region=us-east-1): Frontend static hosting assets and match backup data.
- [**CloudFront Distributions**](https://us-east-1.console.aws.amazon.com/cloudfront/v4/home?region=us-east-1#/distributions): Global CDN caching configurations.
- [**KMS (Key Management Service)**](https://us-east-1.console.aws.amazon.com/kms/home?region=us-east-1#/kms/keys): Manage encryption keys securing S3, SNS, and DynamoDB.
- [**IAM (Identity & Access Management)**](https://us-east-1.console.aws.amazon.com/iam/home#/roles): Review the least-privilege execution roles provisioned for Lambdas.

---

## 🛡️ Security Posture & Vulnerability Scanners

CricScore utilizes a strict DevSecOps pipeline. To view the results of the automated security tools:

### Security & Analysis Dashboards (GitHub Native)

- [**CodeQL & Checkov Alerts**](https://github.com/venkatesh-singamsetty/cricscore/security/code-scanning): View static application security testing results (e.g., detected SQL injection, XSS) and Terraform misconfigurations (Checkov issues).
- [**Dependabot SCA Alerts**](https://github.com/venkatesh-singamsetty/cricscore/security/dependabot): View known vulnerabilities in third-party NPM dependencies.

---

### CI/CD Security Scanners (Pipeline Logs)

The following pipelines act as automated gatekeepers. You can view their execution logs and downloadable reports here:

- [**GitLeaks**](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/secrets.yml): Detects hardcoded secrets or AWS keys before code is pushed.
- [**CodeQL SAST**](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/codeql.yml): Native static application security testing to detect vulnerabilities like XSS and SQL injection.
- [**Trivy & Checkov**](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci-cd.yml): Runs inside the unified pipeline to scan dependencies for CRITICAL/HIGH CVEs (Trivy) and audit Terraform misconfigurations (Checkov).
- [**Syft (SBOM)**](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/sbom.yml): Automatically generates a Software Bill of Materials (available as a downloadable artifact `spdx-json` on the pipeline run page).
- [**OWASP ZAP (DAST)**](https://github.com/venkatesh-singamsetty/cricscore/actions/workflows/ci-cd.yml): Runs an active baseline scan against the live deployed API Gateway URLs to detect runtime misconfigurations like missing HTTP headers.

---

### Engineering & Issue Tracking

- [**Open GitHub Issues**](https://github.com/venkatesh-singamsetty/cricscore/issues?q=is%3Aissue+is%3Aopen): View the active queue of pending bugs, requested features, and ongoing tasks. Tracking open issues helps developers understand current system limitations, prioritize upcoming architecture changes, and manage active security remediation efforts.
