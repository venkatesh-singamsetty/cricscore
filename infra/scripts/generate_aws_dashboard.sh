#!/bin/bash
set -e

DOC_PATH="docs/aws_resources_dashboard.md"
LAMBDA_TF="infra/terraform/lambda.tf"
REGION="${AWS_REGION:-us-east-1}"
GITHUB_REPO="${GITHUB_REPOSITORY:-}"
if [ -z "$GITHUB_REPO" ] && command -v gh >/dev/null 2>&1; then
  GITHUB_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
fi
if [ -z "$GITHUB_REPO" ]; then
  REMOTE_URL=$(git config --get remote.origin.url || true)
  GITHUB_REPO=$(printf '%s' "$REMOTE_URL" | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')
fi

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
> All AWS Console links use the region shown in their URL.

---

EOF

# Function to generate environment block
generate_env_block() {
  local ENV_NAME=$1
  local EMOJI=$2
  local TFVARS=$3
  local PROJECT
  local DOMAIN

  PROJECT=$(awk -F '"' '/^[[:space:]]*project_name[[:space:]]*=/ { print $2; exit }' "$TFVARS")
  DOMAIN=$(awk -F '"' '/^[[:space:]]*domain_name[[:space:]]*=/ { print $2; exit }' "$TFVARS")
  if [ -z "$PROJECT" ] || [ -z "$DOMAIN" ]; then
    echo "❌ Missing project_name or domain_name in $TFVARS" >&2
    exit 1
  fi
  local FRONTEND_URL="https://${DOMAIN}"
  local HTTP_API="https://api.${DOMAIN}"
  local WS_API="wss://ws.${DOMAIN}"

  cat << EOF >> "$DOC_PATH"
## ${EMOJI} ${ENV_NAME}

### Application Endpoints
- **Frontend App**: [${FRONTEND_URL}](${FRONTEND_URL})
- **HTTP API Gateway**: \`${HTTP_API}\`
- **WebSocket API**: \`${WS_API}\`

### Serverless Compute (AWS Lambda)
EOF

  for LAMBDA in $LAMBDAS; do
    FUNC_NAME="${PROJECT}-${LAMBDA}"
    echo "- [**${LAMBDA}**](https://${REGION}.console.aws.amazon.com/lambda/home?region=${REGION}#/functions/${FUNC_NAME})" >> "$DOC_PATH"
  done

  cat << EOF >> $DOC_PATH

### Application Logs (CloudWatch Logs)
EOF

  for LAMBDA in $LAMBDAS; do
    FUNC_NAME="${PROJECT}-${LAMBDA}"
    echo "- [**${LAMBDA} Logs**](https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#logsV2:log-groups/log-group/\$252Faws\$252Flambda\$252F${FUNC_NAME})" >> "$DOC_PATH"
  done

  cat << EOF >> $DOC_PATH

---
EOF
}

# Dev Environment
generate_env_block \
  "Development (DEV)" "🟢" "infra/terraform/environments/dev.tfvars"

# Prod Environment
generate_env_block \
  "Production (PROD)" "🔵" "infra/terraform/environments/prod.tfvars"

cat << EOF >> $DOC_PATH

## 📊 Observability & Tracing (AWS X-Ray & Alarms)

AWS X-Ray visualizes the request path between API Gateway, Lambda, and SNS, helping identify latency bottlenecks or 5xx failures.

- [**CloudWatch Log Groups**](https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#logsV2:log-groups): Lambda stdout/stderr; individual handlers may emit text or JSON.
- [**CloudWatch Metrics**](https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#metricsV2): View API traffic, Lambda invocations, and SQS queue depths; charges depend on metrics and features used.
- [**X-Ray Service Map**](https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#xray:service-map/map): A visual node-graph of all interacting services.
- [**X-Ray Traces Dashboard**](https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#xray:traces/query): Detailed timelines of individual HTTP requests.
- [**CloudWatch Alarms Dashboard**](https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#alarmsV2:): View active alarms for Match API and Score Update Lambda errors.

---

## 🌐 Networking & Infrastructure

- [**Cognito User Pools (SSO)**](https://${REGION}.console.aws.amazon.com/cognito/v2/idp/user-pools?region=${REGION}): Manage users, admins, and guest accounts.
- [**API Gateways (HTTP & WebSocket)**](https://${REGION}.console.aws.amazon.com/apigateway/main/apis?region=${REGION}): Manage custom domains and throttling.
- [**Route 53 (DNS)**](https://${REGION}.console.aws.amazon.com/route53/v2/hostedzones): Domain names and routing configurations.
- [**ACM (Certificate Manager)**](https://${REGION}.console.aws.amazon.com/acm/home?region=${REGION}#/certificates): SSL/TLS certificates for API and Frontend custom domains.
- [**SNS Topics (Pub/Sub)**](https://${REGION}.console.aws.amazon.com/sns/v3/home?region=${REGION}#/topics): View the event buses that decouple your microservices.
- [**SQS Queues**](https://${REGION}.console.aws.amazon.com/sqs/v3/home?region=${REGION}#/queues): View FIFO persistence queues. No DLQ is currently configured.
- [**DynamoDB Tables**](https://${REGION}.console.aws.amazon.com/dynamodbv2/home?region=${REGION}#tables): View NoSQL state, including the WebSocket connection registry.
- [**Aiven PostgreSQL Console**](https://console.aiven.io/): Access the managed relational database.
- [**S3 Buckets**](https://s3.console.aws.amazon.com/s3/buckets?region=${REGION}): Frontend static hosting assets and match backup data.
- [**CloudFront Distributions**](https://${REGION}.console.aws.amazon.com/cloudfront/v4/home?region=${REGION}#/distributions): Global CDN caching configurations.
- [**ECR Repositories (Docker ML)**](https://${REGION}.console.aws.amazon.com/ecr/repositories?region=${REGION}): Manage the container images used for the ML Predict engine.
- [**AWS Cost Budgets**](https://${REGION}.console.aws.amazon.com/billing/home?region=${REGION}#/budgets): View configured budget notifications; budgets do not cap spending.
- [**SES (Simple Email Service)**](https://${REGION}.console.aws.amazon.com/ses/home?region=${REGION}#/identities): Manage verified email senders for match reporting.
- [**IAM (Identity & Access Management)**](https://${REGION}.console.aws.amazon.com/iam/home#/roles): Review Lambda execution roles and policies before deployment.

---

## 🛡️ Security Posture & Vulnerability Scanners

CricScore uses automated security scans in GitHub Actions. Scan results depend on workflow status and repository configuration:

### Security & Analysis Dashboards (GitHub Native)

- [**CodeQL Alerts**](https://github.com/${GITHUB_REPO}/security/code-scanning): View available static application security analysis results.
- [**Dependabot SCA Alerts**](https://github.com/${GITHUB_REPO}/security/dependabot): View known vulnerabilities in third-party NPM dependencies.

---

### CI/CD Security Scanners (Pipeline Logs)

Use these workflow links to review scan status, logs, and available reports:

- [**GitLeaks / CI**](https://github.com/${GITHUB_REPO}/actions/workflows/ci.yml): Runs secret scanning as part of CI.
- [**CodeQL SAST**](https://github.com/${GITHUB_REPO}/actions/workflows/codeql.yml): Native static application security testing to detect vulnerabilities like XSS and SQL injection.
- [**Trivy & Checkov**](https://github.com/${GITHUB_REPO}/actions/workflows/ci.yml): Scans dependencies and Terraform configuration.
- [**Syft (SBOM)**](https://github.com/${GITHUB_REPO}/actions/workflows/sbom.yml): Automatically generates a Software Bill of Materials (available as a downloadable artifact \`spdx-json\` on the pipeline run page).
- [**OWASP ZAP (DAST)**](https://github.com/${GITHUB_REPO}/actions/workflows/ci.yml): Runs a non-blocking baseline scan after dev deployment; production uses the separate CD workflow.

---

### Engineering & Issue Tracking

- [**Open GitHub Issues**](https://github.com/${GITHUB_REPO}/issues?q=is%3Aissue+is%3Aopen): View the active queue of pending bugs, requested features, and ongoing tasks. Tracking open issues helps developers understand current system limitations, prioritize upcoming architecture changes, and manage active security remediation efforts.
EOF

echo "✅ Dashboard generated at $DOC_PATH"
