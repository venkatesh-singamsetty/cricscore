#!/bin/bash
set -e

DOC_PATH="docs/aws_resources_dashboard.md"
LAMBDA_TF="infra/terraform/lambda.tf"
REGION="us-east-1"
GITHUB_REPO="venkatesh-singamsetty/cricscore"

# If the terraform file doesn't exist, exit cleanly
if [ ! -f "$LAMBDA_TF" ]; then
  exit 0
fi

# Extract lambda suffixes by only looking at function_name assignments
LAMBDAS=$(grep 'function_name[[:space:]]*=' $LAMBDA_TF | grep -oE '\$\{var\.project_name\}-[a-zA-Z0-9_-]+' | sed "s/\${var.project_name}-//g" | sort | uniq)

cat << 'EOF' > $DOC_PATH
# 🛠️ CricScore AWS & Security Resources Dashboard

This document provides quick-access UI links to view the live AWS resources, telemetry data, and security dashboards for the CricScore platform.

> [!NOTE]
> All links assume you are logged into your AWS Console and your primary region is `us-east-1`.

---

EOF

# Function to generate environment block
generate_env_block() {
  local ENV_NAME=$1
  local EMOJI=$2
  local PROJECT=$3
  local FRONTEND_URL=$4
  local HTTP_API=$5
  local WS_API=$6

  cat << EOF >> $DOC_PATH
## ${EMOJI} ${ENV_NAME}

### Application Endpoints
- **Frontend App**: [${FRONTEND_URL}](${FRONTEND_URL})
- **HTTP API Gateway**: \`${HTTP_API}\`
- **WebSocket API**: \`${WS_API}\`

### Serverless Compute (AWS Lambda)
EOF

  for LAMBDA in $LAMBDAS; do
    FUNC_NAME="${PROJECT}-${LAMBDA}"
    echo "- [**${LAMBDA}**](https://${REGION}.console.aws.amazon.com/lambda/home?region=${REGION}#/functions/${FUNC_NAME})" >> $DOC_PATH
  done

  cat << EOF >> $DOC_PATH

### Application Logs (CloudWatch Logs)
EOF

  for LAMBDA in $LAMBDAS; do
    FUNC_NAME="${PROJECT}-${LAMBDA}"
    echo "- [**${LAMBDA} Logs**](https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#logsV2:log-groups/log-group/\$252Faws\$252Flambda\$252F${FUNC_NAME})" >> $DOC_PATH
  done

  cat << EOF >> $DOC_PATH

---
EOF
}

# Dev Environment
generate_env_block \
  "Development (DEV)" "🟢" "cricscoredev" \
  "https://cricscoredev.venkateshsingamsetty.com" \
  "https://api.cricscoredev.venkateshsingamsetty.com" \
  "wss://ws.cricscoredev.venkateshsingamsetty.com"

# Prod Environment
generate_env_block \
  "Production (PROD)" "🔵" "cricscore" \
  "https://cricscore.venkateshsingamsetty.com" \
  "https://api.cricscore.venkateshsingamsetty.com" \
  "wss://ws.cricscore.venkateshsingamsetty.com"

cat << EOF >> $DOC_PATH

## 📊 Observability & Tracing (AWS X-Ray & Alarms)

AWS X-Ray visualizes the request path between API Gateway, Lambda, and SNS, helping identify latency bottlenecks or 5xx failures.

- [**Custom Mission Control Dashboard**](https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards/dashboard/cricscoredev-mission-control): A unified, custom Terraform-provisioned dashboard showing API traffic, Lambda invocations, and SQS queue depths in one place.
- [**X-Ray Service Map**](https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#xray:service-map/map): A visual node-graph of all interacting services.
- [**X-Ray Traces Dashboard**](https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#xray:traces/query): Detailed timelines of individual HTTP requests.
- [**CloudWatch Alarms Dashboard**](https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#alarmsV2:): View active alarms for API 5XX errors and Lambda timeouts.

---

## 🌐 Networking & Infrastructure

- [**Cognito User Pools (SSO)**](https://${REGION}.console.aws.amazon.com/cognito/v2/idp/user-pools?region=${REGION}): Manage users, admins, and guest accounts.
- [**API Gateways (REST & WebSocket)**](https://${REGION}.console.aws.amazon.com/apigateway/main/apis?region=${REGION}): Manage custom domains and throttling.
- [**Route 53 (DNS)**](https://${REGION}.console.aws.amazon.com/route53/v2/hostedzones): Domain names and routing configurations.
- [**ACM (Certificate Manager)**](https://${REGION}.console.aws.amazon.com/acm/home?region=${REGION}#/certificates): SSL/TLS certificates for API and Frontend custom domains.
- [**SNS Topics (Pub/Sub)**](https://${REGION}.console.aws.amazon.com/sns/v3/home?region=${REGION}#/topics): View the event buses that decouple your microservices.
- [**SQS Queues (DLQ)**](https://${REGION}.console.aws.amazon.com/sqs/v3/home?region=${REGION}#/queues): View the Dead-Letter Queues capturing failed events.
- [**DynamoDB Tables**](https://${REGION}.console.aws.amazon.com/dynamodbv2/home?region=${REGION}#tables): View NoSQL state and live caching data.
- [**Aiven PostgreSQL Console**](https://console.aiven.io/): Access the managed relational database.
- [**S3 Buckets**](https://s3.console.aws.amazon.com/s3/buckets?region=${REGION}): Frontend static hosting assets and match backup data.
- [**CloudFront Distributions**](https://${REGION}.console.aws.amazon.com/cloudfront/v4/home?region=${REGION}#/distributions): Global CDN caching configurations.
- [**KMS (Key Management Service)**](https://${REGION}.console.aws.amazon.com/kms/home?region=${REGION}#/kms/keys): Manage encryption keys securing S3, SNS, and DynamoDB.
- [**IAM (Identity & Access Management)**](https://${REGION}.console.aws.amazon.com/iam/home#/roles): Review the least-privilege execution roles provisioned for Lambdas.

---

## 🛡️ Security Posture & Vulnerability Scanners

CricScore utilizes a strict DevSecOps pipeline. To view the results of the automated security tools:

### Security & Analysis Dashboards (GitHub Native)

- [**CodeQL & Checkov Alerts**](https://github.com/${GITHUB_REPO}/security/code-scanning): View static application security testing results (e.g., detected SQL injection, XSS) and Terraform misconfigurations (Checkov issues).
- [**Dependabot SCA Alerts**](https://github.com/${GITHUB_REPO}/security/dependabot): View known vulnerabilities in third-party NPM dependencies.

---

### CI/CD Security Scanners (Pipeline Logs)

The following pipelines act as automated gatekeepers. You can view their execution logs and downloadable reports here:

- [**GitLeaks**](https://github.com/${GITHUB_REPO}/actions/workflows/secrets.yml): Detects hardcoded secrets or AWS keys before code is pushed.
- [**CodeQL SAST**](https://github.com/${GITHUB_REPO}/actions/workflows/codeql.yml): Native static application security testing to detect vulnerabilities like XSS and SQL injection.
- [**Trivy & Checkov**](https://github.com/${GITHUB_REPO}/actions/workflows/ci-cd.yml): Runs inside the unified pipeline to scan dependencies for CRITICAL/HIGH CVEs (Trivy) and audit Terraform misconfigurations (Checkov).
- [**Syft (SBOM)**](https://github.com/${GITHUB_REPO}/actions/workflows/sbom.yml): Automatically generates a Software Bill of Materials (available as a downloadable artifact \`spdx-json\` on the pipeline run page).
- [**OWASP ZAP (DAST)**](https://github.com/${GITHUB_REPO}/actions/workflows/ci-cd.yml): Runs an active baseline scan against the live deployed API Gateway URLs to detect runtime misconfigurations like missing HTTP headers.

---

### Engineering & Issue Tracking

- [**Open GitHub Issues**](https://github.com/${GITHUB_REPO}/issues?q=is%3Aissue+is%3Aopen): View the active queue of pending bugs, requested features, and ongoing tasks. Tracking open issues helps developers understand current system limitations, prioritize upcoming architecture changes, and manage active security remediation efforts.
EOF

echo "✅ Dashboard generated at $DOC_PATH"
