#!/bin/bash
set -e

DOC_PATH="docs/aws_resources_dashboard.md"
LAMBDA_TF="terraform/lambda.tf"
REGION="us-east-1"
PROJECT="cricscore"

# If the terraform file doesn't exist, exit cleanly
if [ ! -f "$LAMBDA_TF" ]; then
  exit 0
fi

# Extract lambda suffixes by only looking at `function_name` assignments
LAMBDAS=$(grep 'function_name[[:space:]]*=' $LAMBDA_TF | grep -oE '\$\{var\.project_name\}-[a-zA-Z0-9_-]+' | sed "s/\${var.project_name}-//g" | sort | uniq)

cat << 'EOF' > $DOC_PATH
# 🛠️ CricScore AWS & Security Resources Dashboard

This document provides quick-access UI links to view the live AWS resources, telemetry data, and security dashboards for the CricScore platform.

> [!NOTE]
> All links assume you are logged into your AWS Console and your primary region is `us-east-1`.

---

## ⚡ Serverless Compute (AWS Lambda)

Direct links to view the source code, configurations, and test events for the serverless functions:

EOF

for LAMBDA in $LAMBDAS; do
  FUNC_NAME="${PROJECT}-${LAMBDA}"
  echo "*   [**${LAMBDA}** (\`${FUNC_NAME}\`)](https://${REGION}.console.aws.amazon.com/lambda/home?region=${REGION}#/functions/${FUNC_NAME}?tab=code)" >> $DOC_PATH
done

cat << 'EOF' >> $DOC_PATH

---

## 📝 Application Logs (CloudWatch Logs)

Direct links to the live execution logs (stdout/stderr) and `console.log()` outputs for troubleshooting:

EOF

for LAMBDA in $LAMBDAS; do
  FUNC_NAME="${PROJECT}-${LAMBDA}"
  echo "*   [**${LAMBDA} Logs**](https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#logsV2:log-groups/log-group/\$252Faws\$252Flambda\$252F${FUNC_NAME})" >> $DOC_PATH
done

cat << 'EOF' >> $DOC_PATH

---

## 📊 Observability & Tracing (AWS X-Ray & Alarms)

AWS X-Ray visualizes the request path between API Gateway, Lambda, and SNS, helping identify latency bottlenecks or 5xx failures.

*   [**X-Ray Service Map**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:service-map/map): A visual node-graph of all interacting services.
*   [**X-Ray Traces Dashboard**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#xray:traces/query): Detailed timelines of individual HTTP requests.
*   [**CloudWatch Alarms Dashboard**](https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#alarmsV2:): View active alarms for API 5XX errors and Lambda timeouts.

---

## 🌐 Networking & Infrastructure

*   [**API Gateways (REST & WebSocket)**](https://us-east-1.console.aws.amazon.com/apigateway/main/apis?region=us-east-1): Manage custom domains and throttling.
*   [**SNS Topics (Pub/Sub)**](https://us-east-1.console.aws.amazon.com/sns/v3/home?region=us-east-1#/topics): View the event buses that decouple your microservices.
*   [**S3 Buckets**](https://s3.console.aws.amazon.com/s3/buckets?region=us-east-1): Frontend static hosting assets.
*   [**CloudFront Distributions**](https://us-east-1.console.aws.amazon.com/cloudfront/v4/home?region=us-east-1#/distributions): Global CDN caching configurations.

---

## 🛡️ Security Posture & Vulnerability Scanners

CricScore utilizes a strict DevSecOps pipeline. To view the results of the automated security tools:

### GitHub Native Dashboards
*   [**CodeQL & Checkov Alerts**](https://github.com/venkatesh-singamsetty/cricscore/security/code-scanning): View static application security testing results (e.g., detected SQL injection, XSS) and Terraform misconfigurations (Checkov issues).
*   [**Dependabot SCA Alerts**](https://github.com/venkatesh-singamsetty/cricscore/security/dependabot): View known vulnerabilities in third-party NPM dependencies.

### CI/CD Pipeline Scanners (View in GitHub Actions Logs)
The following tools block Pull Requests automatically. You can view their output in the [GitHub Actions UI](https://github.com/venkatesh-singamsetty/cricscore/actions) on any running PR:
*   **GitLeaks**: Detects hardcoded secrets or AWS keys before code is pushed.
*   **Trivy**: Scans infrastructure and dependencies for CRITICAL/HIGH vulnerabilities.
*   **Checkov**: Analyzes Terraform (`.tf`) files. (Note: The pipeline output is logged here, but the actual security issues are automatically uploaded to the **GitHub Native Dashboards -> Code Scanning** tab for easier tracking and remediation).
*   **Syft (SBOM)**: Generates a Software Bill of Materials (available as a downloadable artifact `spdx-json` on the CI pipeline summary page).
*   **OWASP ZAP (DAST)**: Runs an active baseline scan against the deployed API Gateway URLs during E2E testing to detect live misconfigurations like missing HTTP headers.

---

## 📋 Project Management & Issue Tracking

*   [**Open GitHub Issues**](https://github.com/venkatesh-singamsetty/cricscore/issues?q=is%3Aissue+is%3Aopen): View the active queue of pending bugs, requested features, and ongoing tasks. Tracking open issues helps developers understand current system limitations, prioritize upcoming architecture changes, and manage active security remediation efforts.
EOF
