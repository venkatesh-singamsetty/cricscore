#!/usr/bin/env python3
"""
CricScore Central Platform & Artifacts Dashboard Generator
Generates docs/platform_dashboard.md with live references across the entire stack:
- Web & API Endpoints (Dev & Prod)
- CloudFront CDN, S3 Buckets & Match Backups
- Serverless Lambdas (Node.js & Docker Python) & CloudWatch Logs
- ECR Container Images, Digests & Sizes
- ML Models (XGBoost v2.2.0), Metrics & Registry Artifacts
- Aiven PostgreSQL 16 & pgvector RAG Knowledge Store
- GitHub Repository Level Resources, Workflows, Vars, Secrets & Artifacts
- DynamoDB, SQS FIFO & SNS Event Queues
- Security Posture & CI/CD SBOM Artifacts
"""

import json
import os
import re
import subprocess
from pathlib import Path
import urllib.parse

REPO_ROOT = Path(__file__).resolve().parent.parent.parent

def load_env_local():
    """Load .env.local without exposing secrets."""
    env_vars = {}
    env_file = REPO_ROOT / ".env.local"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env_vars[k.strip()] = v.strip("\"' ")
    return env_vars

ENV_LOCAL = load_env_local()

def get_config_val(name, default=""):
    return os.environ.get(name) or ENV_LOCAL.get(name, default)

REGION = get_config_val("AWS_REGION", "us-east-1")
STATE_BUCKET = get_config_val("TF_STATE_BUCKET", "")
ACCOUNT_ID = ""

try:
    ident = subprocess.check_output(["aws", "sts", "get-caller-identity", "--output", "json"], stderr=subprocess.DEVNULL)
    ACCOUNT_ID = json.loads(ident).get("Account", "")
except Exception:
    ACCOUNT_ID = "926789386606"  # fallback known CricScore AWS account

if not STATE_BUCKET and ACCOUNT_ID:
    STATE_BUCKET = "venky-2026-terraform-state"

def get_github_repo():
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    if repo:
        return repo
    try:
        out = subprocess.check_output(["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], stderr=subprocess.DEVNULL)
        if out.strip():
            return out.decode().strip()
    except Exception:
        # Fallback to git remote url if gh CLI is unavailable or unauthenticated
        pass
    try:
        out = subprocess.check_output(["git", "config", "--get", "remote.origin.url"], stderr=subprocess.DEVNULL).decode().strip()
        m = re.search(r"github\.com[:/]([^/]+/[^/.]+)", out)
        if m:
            return m.group(1)
    except Exception:
        # Fallback to default canonical repository name if remote URL cannot be parsed
        pass
    return "venkatesh-singamsetty/cricscore"

GITHUB_REPO = get_github_repo()

def get_terraform_state(env):
    """Fetch terraform state from S3."""
    if STATE_BUCKET:
        try:
            out = subprocess.check_output(
                ["aws", "s3", "cp", f"s3://{STATE_BUCKET}/cricscore/{env}/terraform.tfstate", "-"],
                stderr=subprocess.DEVNULL
            )
            return json.loads(out)
        except Exception:
            pass
    return None

def extract_state_resources(state):
    """Parse terraform state resources into structured dictionary."""
    if not state:
        return {}
    res = {}
    for r in state.get("resources", []):
        t = r.get("type", "")
        name = r.get("name", "")
        key = f"{t}.{name}"
        instances = r.get("instances", [])
        if instances:
            attrs = instances[0].get("attributes", {})
            res[key] = attrs
    return res

def get_ecr_latest(repo_name):
    """Fetch the single active ECR image (tagged with the model version, e.g. v2.2.0).

    The repository retains exactly one image (lifecycle countNumber=1), so the
    most recently pushed image is the active one. No ':latest' tag is pushed.
    """
    try:
        out = subprocess.check_output([
            "aws", "ecr", "describe-images",
            "--repository-name", repo_name,
            "--output", "json"
        ], stderr=subprocess.DEVNULL)
        images = json.loads(out)["imageDetails"]
        img = max(images, key=lambda i: str(i.get("imagePushedAt", "")))
        pushed = img.get("imagePushedAt", "N/A")
        if "T" in str(pushed):
            pushed = str(pushed).split(".")[0].replace("T", " ")
        return {
            "digest": img.get("imageDigest", "N/A"),
            "pushed": pushed,
            "size_mb": round(img.get("imageSizeInBytes", 0) / (1024 * 1024), 2)
        }
    except Exception:
        # Offline fallback: xgboost-cpu image is ~309 MB (single retained image)
        return {
            "digest": "N/A (ECR unreachable)",
            "pushed": "N/A",
            "size_mb": 309
        }

def get_ml_metadata():
    manifest_path = REPO_ROOT / "apps" / "ml-engine" / "model_manifest.json"
    live_meta_path = REPO_ROOT / "apps" / "ml-engine" / "live_metadata.json"
    manifest = {}
    live_meta = {}
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text())
    if live_meta_path.exists():
        live_meta = json.loads(live_meta_path.read_text())
    return manifest, live_meta

def get_db_info():
    url = get_config_val("TF_DATABASE_URL", "")
    if not url:
        return "cricscore-db-venky-cric-score.b.aivencloud.com", "17727", "defaultdb"
    try:
        parsed = urllib.parse.urlparse(url)
        return parsed.hostname or "cricscore-db-venky-cric-score.b.aivencloud.com", str(parsed.port or "17727"), parsed.path.lstrip("/") or "defaultdb"
    except Exception:
        return "cricscore-db-venky-cric-score.b.aivencloud.com", "17727", "defaultdb"

def get_lambda_names():
    tf_file = REPO_ROOT / "infra" / "terraform" / "lambda.tf"
    if not tf_file.exists():
        return [
            "broadcaster", "chat-api", "cognito-presignup", "match-api",
            "ml-predict", "onconnect", "ondisconnect", "score-upd", "storage-worker"
        ]
    content = tf_file.read_text()
    lambdas = sorted(list(set(re.findall(r'function_name\s*=\s*"\$\{var\.project_name\}-([a-zA-Z0-9_-]+)"', content))))
    return lambdas if lambdas else [
        "broadcaster", "chat-api", "cognito-presignup", "match-api",
        "ml-predict", "onconnect", "ondisconnect", "score-upd", "storage-worker"
    ]

# Gather data
DEV_STATE = get_terraform_state("dev")
PROD_STATE = get_terraform_state("prod")
DEV_RES = extract_state_resources(DEV_STATE)
PROD_RES = extract_state_resources(PROD_STATE)

LAMBDA_LIST = get_lambda_names()
ML_MANIFEST, ML_LIVE_META = get_ml_metadata()
DB_HOST, DB_PORT, DB_NAME = get_db_info()

def res_attr(res_dict, key, attr, fallback=""):
    return res_dict.get(key, {}).get(attr, fallback)

# Dev Resource IDs
DEV_DOMAIN = get_config_val("DEV_DOMAIN_NAME", "cricscoredev.venkateshsingamsetty.com")
DEV_PROJECT = get_config_val("DEV_PROJECT_NAME", "cricscoredev")
DEV_CF_ID = res_attr(DEV_RES, "aws_cloudfront_distribution.s3_distribution", "id", "E1K3FWDNEXFSL0")
DEV_S3_APP = res_attr(DEV_RES, "aws_s3_bucket.static_app", "id", "cricscoredev-app-e8d6bb50c5656dc8a2271c54a0")
DEV_S3_BACKUPS = res_attr(DEV_RES, "aws_s3_bucket.match_backups", "id", "cricscoredev-match-backups-937fe838a46144fff5facd682f")
DEV_S3_LOGS = res_attr(DEV_RES, "aws_s3_bucket.static_app_logs", "id", "cricscoredev-app-logs-ec6008161838564a0781274d49")
DEV_HTTP_API_ID = res_attr(DEV_RES, "aws_apigatewayv2_api.http_api", "id", "sx6hhs0yj6")
DEV_WS_API_ID = res_attr(DEV_RES, "aws_apigatewayv2_api.websocket_api", "id", "ql2tnw8ls6")
DEV_USER_POOL_ID = res_attr(DEV_RES, "aws_cognito_user_pool.pool", "id", "us-east-1_InxzxljX7")
DEV_CLIENT_ID = res_attr(DEV_RES, "aws_cognito_user_pool_client.client", "id", "1n4m9rm96nhkd1vnqpnfsr1eg9")
DEV_COGNITO_DOMAIN = res_attr(DEV_RES, "aws_cognito_user_pool_domain.domain", "domain", "cricscoredev-auth-dev")
DEV_DYNAMO_TABLE = res_attr(DEV_RES, "aws_dynamodb_table.connections", "id", "cricscoredev-connections")
DEV_SQS_NAME = "cricscoredev-storage-buffer.fifo"
DEV_SNS_EVENTS = "cricscoredev-match-events"
DEV_SNS_ALERTS = "cricscoredev-lambda-alerts"
DEV_ECR_REPO = "cricscoredev-ml-predict"
DEV_ECR_IMG = get_ecr_latest(DEV_ECR_REPO)

# Prod Resource IDs
PROD_DOMAIN = get_config_val("PROD_DOMAIN_NAME", "cricscore.venkateshsingamsetty.com")
PROD_PROJECT = get_config_val("PROD_PROJECT_NAME", "cricscore")
PROD_CF_ID = res_attr(PROD_RES, "aws_cloudfront_distribution.s3_distribution", "id", "E3FVVHMKMZ5G5O")
PROD_S3_APP = res_attr(PROD_RES, "aws_s3_bucket.static_app", "id", "cricscore-app-7e93ca64fca840e1639f6fbd71")
PROD_S3_BACKUPS = res_attr(PROD_RES, "aws_s3_bucket.match_backups", "id", "cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d")
PROD_S3_LOGS = res_attr(PROD_RES, "aws_s3_bucket.static_app_logs", "id", "cricscore-app-logs-b123ba8b0aa118a0a9fee8bbc2")
PROD_HTTP_API_ID = res_attr(PROD_RES, "aws_apigatewayv2_api.http_api", "id", "ispht71fh0")
PROD_WS_API_ID = res_attr(PROD_RES, "aws_apigatewayv2_api.websocket_api", "id", "to0pkago8j")
PROD_USER_POOL_ID = res_attr(PROD_RES, "aws_cognito_user_pool.pool", "id", "us-east-1_7OssmfCnh")
PROD_CLIENT_ID = res_attr(PROD_RES, "aws_cognito_user_pool_client.client", "id", "5gn0fv3ha5m7t7ah66quuavhv5")
PROD_COGNITO_DOMAIN = res_attr(PROD_RES, "aws_cognito_user_pool_domain.domain", "domain", "cricscore-auth-prod")
PROD_DYNAMO_TABLE = res_attr(PROD_RES, "aws_dynamodb_table.connections", "id", "cricscore-connections")
PROD_SQS_NAME = "cricscore-storage-buffer.fifo"
PROD_SNS_EVENTS = "cricscore-match-events"
PROD_SNS_ALERTS = "cricscore-lambda-alerts"
PROD_ECR_REPO = "cricscore-ml-predict"
PROD_ECR_IMG = get_ecr_latest(PROD_ECR_REPO)

def build_markdown():
    lines = []
    lines.append("# 🛠️ CricScore Unified Platform & Artifacts Dashboard")
    lines.append("")
    lines.append("A central single-pane-of-glass directory providing live references across all layers of the CricScore platform: GitHub repository architecture, variables, secrets, actions, build artifacts, serverless infrastructure, container images, machine learning models, database vector schemas, and security reports.")
    lines.append("")
    lines.append(f"> **Automated Directory**: Active resource inventory for `{GITHUB_REPO}` across AWS Account `{ACCOUNT_ID}` (`{REGION}`) and Aiven Cloud. To refresh, run `./infra/scripts/generate_platform_dashboard.sh`.")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 📌 Quick Navigation")
    lines.append("- [🐙 GitHub Repository Resources, Actions, Vars & Secrets](#-github-repository-resources-actions-vars--secrets)")
    lines.append("- [🟢 Development Environment](#-development-dev)")
    lines.append("- [🔵 Production Environment](#-production-prod)")
    lines.append("- [🤖 ML Models, Container Images & MLOps Registry](#-ml-models-container-images--mlops-registry)")
    lines.append("- [🗄️ Database, Vectors & RAG Architecture](#-database-vectors--rag-architecture-aiven-postgresql)")
    lines.append("- [📦 Storage & S3 Buckets](#-storage-s3-buckets--terraform-state)")
    lines.append("- [🛡️ Security Posture, SBOM & CI/CD Scans](#-security-posture-sbom--cicd-scans)")
    lines.append("- [📊 Observability, Traces & Alarms](#-observability-tracing--alarms-aws-x-ray--cloudwatch)")
    lines.append("")
    lines.append("---")
    lines.append("")

    # GITHUB REPO LEVEL RESOURCES SECTION
    lines.append("## 🐙 GitHub Repository Resources, Actions, Vars & Secrets")
    lines.append("")
    lines.append("| Property | Value / Link |")
    lines.append("|---|---|")
    lines.append(f"| **GitHub Repository** | [`{GITHUB_REPO}`](https://github.com/{GITHUB_REPO}) |")
    lines.append("| **Default Branch** | `main` (Protected; requires PR status checks before merge) |")
    lines.append(f"| **GitHub Environments** | [`dev`](https://github.com/{GITHUB_REPO}/deployments/activity_log?environment=dev) and [`prod`](https://github.com/{GITHUB_REPO}/deployments/activity_log?environment=prod) |")
    lines.append(f"| **Releases & Version Tags** | [`GitHub Releases`](https://github.com/{GITHUB_REPO}/releases) (Automated semantic versioning via `semantic-release`) |")
    lines.append("")

    lines.append("### ⚙️ GitHub Actions Workflow Catalog")
    lines.append("| Workflow Name | File | Trigger Events | Primary Responsibilities | Direct Console Link |")
    lines.append("|---|---|---|---|---|")
    lines.append(f"| **CI (Continuous Integration)** | `.github/workflows/ci.yml` | Pull requests, push to `main` | 4 validation suites (Security, Frontend, Backend, Python AI/ML); deploys and tests `dev` on `main` merge | [Open Workflow](https://github.com/{GITHUB_REPO}/actions/workflows/ci.yml) |")
    lines.append(f"| **CD (Continuous Delivery)** | `.github/workflows/cd.yml` | Release published (`v*`) | Production deployment, Playwright E2E against Prod, OWASP ZAP baseline scan | [Open Workflow](https://github.com/{GITHUB_REPO}/actions/workflows/cd.yml) |")
    lines.append(f"| **Semantic Release** | `.github/workflows/release.yml` | CI success on `main` | Analyzes conventional commits, cuts next `v*` tag, publishes release notes & updates changelog | [Open Workflow](https://github.com/{GITHUB_REPO}/actions/workflows/release.yml) |")
    lines.append(f"| **CodeQL SAST Analysis** | `.github/workflows/codeql.yml` | PRs, push to `main`, weekly schedule | Multi-language static application security testing (JS/TS & Python) | [Open Workflow](https://github.com/{GITHUB_REPO}/actions/workflows/codeql.yml) |")
    lines.append(f"| **Generate SBOM** | `.github/workflows/sbom.yml` | Push to `main`, release | Generates Syft Software Bill of Materials in SPDX JSON format (`spdx-json` artifact) | [Open Workflow](https://github.com/{GITHUB_REPO}/actions/workflows/sbom.yml) |")
    lines.append(f"| **MLOps Pipeline (Win Predictor)** | `.github/workflows/mlops-pipeline.yml` | Dataset or training script changes, monthly schedule | 8-model benchmark evaluation (`compare_models.py`), XGBoost champion quality gate, artifact upload | [Open Workflow](https://github.com/{GITHUB_REPO}/actions/workflows/mlops-pipeline.yml) |")
    lines.append(f"| **ML Model Release & Rollback** | `.github/workflows/ml-model-release.yml` | Manual `workflow_dispatch` | Promotes or rolls back `MODEL_VERSION` on `dev`/`prod` Lambda and runs live smoke test | [Open Workflow](https://github.com/{GITHUB_REPO}/actions/workflows/ml-model-release.yml) |")
    lines.append(f"| **Terraform Drift Detection** | `.github/workflows/drift.yml` | Daily schedule (`00:00 UTC`) | Verifies Terraform state synchronization with AWS resources across `dev` and `prod` | [Open Workflow](https://github.com/{GITHUB_REPO}/actions/workflows/drift.yml) |")
    lines.append(f"| **Database Keep-Alive** | `.github/workflows/keepalive.yml` | Scheduled | Sends keep-alive query to prevent Aiven PostgreSQL free-tier service hibernation | [Open Workflow](https://github.com/{GITHUB_REPO}/actions/workflows/keepalive.yml) |")
    lines.append(f"| **Terraform Force Unlock** | `.github/workflows/terraform-unlock.yml` | Manual `workflow_dispatch` | Emergency administrative release of stuck S3 backend `.tflock` locks | [Open Workflow](https://github.com/{GITHUB_REPO}/actions/workflows/terraform-unlock.yml) |")
    lines.append(f"| **Dependabot Updates** | `.github/dependabot.yml` | Weekly schedule | Automated security PRs for npm, pip, and GitHub Actions dependencies | [Open Dependabot](https://github.com/{GITHUB_REPO}/security/dependabot) |")
    lines.append("")

    lines.append("### 📋 GitHub Repository Variables (`vars.*`)")
    lines.append("| Variable Name | Expected Value / Format | Injection Scope | Description |")
    lines.append("|---|---|---|---|")
    lines.append(f"| `AWS_REGION` | `{REGION}` | CI, CD, Workflows | Target AWS deployment region (defaults to `us-east-1`) |")
    lines.append("| `DOMAIN_NAME` | `cricscore.venkateshsingamsetty.com` | CI, CD, Terraform | Production primary domain name |")
    lines.append("| `ZONE_DOMAIN` | `venkateshsingamsetty.com` | CI, CD, Terraform | Route 53 apex hosted zone domain |")
    lines.append("| `PROJECT_NAME` | `cricscore` | CI, CD, Terraform | Root project prefix for AWS resources (`cricscoredev` / `cricscore`) |")
    lines.append("| `SUBDOMAIN_PREFIX` | `cricscore` | CI, CD, Terraform | Subdomain prefix for custom domains |")
    lines.append(f"| `TF_STATE_BUCKET` | `{STATE_BUCKET}` | CI, CD, Terraform | Global S3 bucket storing remote Terraform state |")
    lines.append("| `ADMIN_EMAIL` | Scorer admin email | Terraform, Cognito | Root administrator email pre-assigned to the Admin group |")
    lines.append("| `LLM_MODEL` | `gpt-4o-mini` | AI Service, Lambdas | Model identifier used for cricket chat assistant |")
    lines.append("| `LLM_BASE_URL` | Optional URL | AI Service, Lambdas | Custom endpoint override for OpenAI-compatible providers |")
    lines.append("")

    lines.append("### 🔒 GitHub Repository Secrets Inventory (`secrets.*`)")
    lines.append("> [!NOTE]")
    lines.append("> In compliance with CricScore Security Standards, only secret metadata and purposes are documented here. Secret values are injected directly into GitHub Actions runners and backend Lambda environments, never exposed to clients or checked into source code.")
    lines.append("")
    lines.append("| Secret Identifier | Consumed By | Purpose & Security Isolation | Presence & Verification |")
    lines.append("|---|---|---|---|")
    lines.append("| `AWS_ACCESS_KEY_ID` | CI, CD, Drift Check | IAM access key used by GitHub Actions runners for Terraform apply and S3/CloudFront sync. | [GitHub Secrets Console](https://github.com/" + GITHUB_REPO + "/settings/secrets/actions) |")
    lines.append("| `AWS_SECRET_ACCESS_KEY` | CI, CD, Drift Check | IAM secret access key paired with `AWS_ACCESS_KEY_ID`. | [GitHub Secrets Console](https://github.com/" + GITHUB_REPO + "/settings/secrets/actions) |")
    lines.append("| `AWS_ROLE_ARN` | CI, CD (Optional) | IAM Role ARN for GitHub Actions OIDC federation (eliminates long-lived access keys). | [GitHub Secrets Console](https://github.com/" + GITHUB_REPO + "/settings/secrets/actions) |")
    lines.append("| `TF_DATABASE_URL` | CI (Migrate), Lambdas | Aiven PostgreSQL connection URI (`postgres://...sslmode=require`). Injected solely into backend Lambdas. | [GitHub Secrets Console](https://github.com/" + GITHUB_REPO + "/settings/secrets/actions) |")
    lines.append("| `TF_SES_SOURCE_EMAIL` | Terraform, Match API | Verified sender email for post-match score report delivery. | [GitHub Secrets Console](https://github.com/" + GITHUB_REPO + "/settings/secrets/actions) |")
    lines.append("| `OPENAI_API_KEY` | Chat API, AI Service | API key for OpenAI `gpt-4o-mini` conversational assistant. Bounded to 600 max tokens/turn. | [GitHub Secrets Console](https://github.com/" + GITHUB_REPO + "/settings/secrets/actions) |")
    lines.append("| `GH_PAT` / `GITHUB_TOKEN` | Semantic Release | GitHub Personal Access Token or workflow token with `contents: write` to publish releases and Git tags. | Managed by GitHub |")
    lines.append("")

    lines.append("### 📦 GitHub Pipeline & Build Artifacts")
    lines.append("| Artifact | Source Workflow | Location / Link |")
    lines.append("|---|---|---|")
    lines.append(f"| **Software Bill of Materials (SPDX JSON)** | `sbom.yml` | Downloadable artifact `spdx-json` in [`Generate SBOM`](https://github.com/{GITHUB_REPO}/actions/workflows/sbom.yml) |")
    lines.append(f"| **CodeQL SAST SARIF Reports** | `codeql.yml` | [`Security → Code scanning`](https://github.com/{GITHUB_REPO}/security/code-scanning) |")
    lines.append(f"| **Trivy & GitLeaks Security Logs** | `ci.yml` | Logged on every PR and push in [`ci.yml`](https://github.com/{GITHUB_REPO}/actions/workflows/ci.yml) |")
    lines.append(f"| **Playwright E2E HTML Reports** | `ci.yml` / `cd.yml` | `playwright-report-dev` and `playwright-report-prod` artifacts |")
    lines.append(f"| **Semantic Release Changelog** | `release.yml` | [`docs/changelog.md`](./changelog.md) and [`GitHub Releases`](https://github.com/{GITHUB_REPO}/releases) |")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Helper for Env Section
    def render_env_section(title, emoji, domain, project, cf_id, s3_app, s3_backups, s3_logs,
                           http_id, ws_id, pool_id, client_id, auth_domain, dynamo_table,
                           sqs_name, sns_events, sns_alerts, ecr_repo, ecr_img):
        lines.append(f"## {emoji} {title}")
        lines.append("")
        lines.append("### 🌐 Core Endpoints, Identity & Storage")
        lines.append("| Resource | Identifier / Endpoint | AWS Console / Direct Link |")
        lines.append("|---|---|---|")
        lines.append(f"| **Frontend Web App** | `https://{domain}` | [Open Web App](https://{domain}) |")
        lines.append(f"| **CloudFront CDN Distribution** | `{cf_id}` | [CloudFront Console](https://{REGION}.console.aws.amazon.com/cloudfront/v4/home?region={REGION}#/distributions/{cf_id}) |")
        lines.append(f"| **HTTP API Gateway** | `https://api.{domain}` (`{http_id}`) | [HTTP API Console](https://{REGION}.console.aws.amazon.com/apigateway/main/apis/{http_id}/routes?region={REGION}) |")
        lines.append(f"| **WebSocket API Gateway** | `wss://ws.{domain}` (`{ws_id}`) | [WebSocket API Console](https://{REGION}.console.aws.amazon.com/apigateway/main/apis/{ws_id}/routes?region={REGION}) |")
        lines.append(f"| **Route 53 & ACM TLS** | `{domain}` | • [Route 53 Console](https://{REGION}.console.aws.amazon.com/route53/v2/hostedzones)<br/>• [ACM Console](https://{REGION}.console.aws.amazon.com/acm/home?region={REGION}#/certificates) |")
        lines.append(f"| **Cognito User Pool** | • Pool: `{pool_id}`<br/>• Client: `{client_id}`<br/>• Domain: `{auth_domain}` | [Cognito Users & Groups](https://{REGION}.console.aws.amazon.com/cognito/v2/idp/user-pools/{pool_id}/users?region={REGION}) |")
        lines.append(f"| **S3 Static Web Bucket** | `s3://{s3_app}` (7d noncurrent lifecycle) | [Open S3 Bucket](https://s3.console.aws.amazon.com/s3/buckets/{s3_app}?region={REGION}) |")
        lines.append(f"| **S3 Match Backups & ML Registry** | `s3://{s3_backups}` (180d backup lifecycle) | [Open S3 Bucket](https://s3.console.aws.amazon.com/s3/buckets/{s3_backups}?region={REGION}) |")
        lines.append(f"| **S3 Access Logs Bucket** | `s3://{s3_logs}` (30d log lifecycle) | [Open S3 Bucket](https://s3.console.aws.amazon.com/s3/buckets/{s3_logs}?region={REGION}) |")
        lines.append(f"| **DynamoDB WS Connections** | `{dynamo_table}` (`PAY_PER_REQUEST`) | [DynamoDB Explorer](https://{REGION}.console.aws.amazon.com/dynamodbv2/home?region={REGION}#item-explorer?table={dynamo_table}) |")
        lines.append(f"| **SQS FIFO Storage Queue** | `{sqs_name}` | [SQS Queue Console](https://{REGION}.console.aws.amazon.com/sqs/v3/home?region={REGION}#/queues/https%3A%2F%2Fsqs.{REGION}.amazonaws.com%2F{ACCOUNT_ID}%2F{sqs_name}) |")
        lines.append(f"| **SNS Match Events Topic** | `{sns_events}` | [SNS Events Topic](https://{REGION}.console.aws.amazon.com/sns/v3/home?region={REGION}#/topic/arn:aws:sns:{REGION}:{ACCOUNT_ID}:{sns_events}) |")
        lines.append(f"| **SNS Lambda Alerts Topic** | `{sns_alerts}` | [SNS Alerts Topic](https://{REGION}.console.aws.amazon.com/sns/v3/home?region={REGION}#/topic/arn:aws:sns:{REGION}:{ACCOUNT_ID}:{sns_alerts}) |")
        lines.append(f"| **ECR ML Container Repo** | `{ecr_repo}` (`{ecr_img['size_mb']} MB`, `countNumber=1`, pushed `{ecr_img['pushed']}`) | [ECR Repo Console](https://{REGION}.console.aws.amazon.com/ecr/repositories/private/{ACCOUNT_ID}/{ecr_repo}?region={REGION}) |")
        lines.append("")

        lines.append("### ⚡ Serverless Compute & Telemetry (AWS Lambda)")
        lines.append("| Lambda Function | Runtime | Function Console | CloudWatch Logs (7-Day Retention) |")
        lines.append("|---|---|---|---|")
        for fn in LAMBDA_LIST:
            full_fn = f"{project}-{fn}"
            runtime = "Docker (Python 3.12, xgboost-cpu)" if fn == "ml-predict" else "Node.js 24.x"
            fn_url = f"https://{REGION}.console.aws.amazon.com/lambda/home?region={REGION}#/functions/{full_fn}"
            log_url = f"https://{REGION}.console.aws.amazon.com/cloudwatch/home?region={REGION}#logsV2:log-groups/log-group/$252Faws$252Flambda$252F{full_fn}"
            lines.append(f"| **`{fn}`** | `{runtime}` | [Open Function]({fn_url}) | [View Logs]({log_url}) |")
        lines.append("")
        lines.append("---")
        lines.append("")

    # DEV Section
    render_env_section(
        title="Development (DEV)",
        emoji="🟢",
        domain=DEV_DOMAIN,
        project=DEV_PROJECT,
        cf_id=DEV_CF_ID,
        s3_app=DEV_S3_APP,
        s3_backups=DEV_S3_BACKUPS,
        s3_logs=DEV_S3_LOGS,
        http_id=DEV_HTTP_API_ID,
        ws_id=DEV_WS_API_ID,
        pool_id=DEV_USER_POOL_ID,
        client_id=DEV_CLIENT_ID,
        auth_domain=DEV_COGNITO_DOMAIN,
        dynamo_table=DEV_DYNAMO_TABLE,
        sqs_name=DEV_SQS_NAME,
        sns_events=DEV_SNS_EVENTS,
        sns_alerts=DEV_SNS_ALERTS,
        ecr_repo=DEV_ECR_REPO,
        ecr_img=DEV_ECR_IMG,
    )

    # PROD Section
    render_env_section(
        title="Production (PROD)",
        emoji="🔵",
        domain=PROD_DOMAIN,
        project=PROD_PROJECT,
        cf_id=PROD_CF_ID,
        s3_app=PROD_S3_APP,
        s3_backups=PROD_S3_BACKUPS,
        s3_logs=PROD_S3_LOGS,
        http_id=PROD_HTTP_API_ID,
        ws_id=PROD_WS_API_ID,
        pool_id=PROD_USER_POOL_ID,
        client_id=PROD_CLIENT_ID,
        auth_domain=PROD_COGNITO_DOMAIN,
        dynamo_table=PROD_DYNAMO_TABLE,
        sqs_name=PROD_SQS_NAME,
        sns_events=PROD_SNS_EVENTS,
        sns_alerts=PROD_SNS_ALERTS,
        ecr_repo=PROD_ECR_REPO,
        ecr_img=PROD_ECR_IMG,
    )

    # ML Models & Containers Section
    lines.append("## 🤖 ML Models, Container Images & MLOps Registry")
    lines.append("")
    lines.append("### Active Champion Model Architecture")
    model_ver = ML_MANIFEST.get('modelVersion', 'v2.2.0')
    lines.append("| Artifact / Property | Value / Location |")
    lines.append("|---|---|")
    lines.append(f"| **Champion Version & Algorithm** | `{model_ver}` (`{ML_MANIFEST.get('algorithm', 'XGBoost')}`) |")
    lines.append(f"| **S3 Model Registry (Dev)** | `s3://{DEV_S3_BACKUPS}/models/{model_ver}/live_win_predictor_model.joblib` ([S3 Console](https://{REGION}.console.aws.amazon.com/s3/buckets/{DEV_S3_BACKUPS}?region={REGION}&prefix=models/{model_ver}/)) |")
    lines.append(f"| **S3 Model Registry (Prod)** | `s3://{PROD_S3_BACKUPS}/models/{model_ver}/live_win_predictor_model.joblib` ([S3 Console](https://{REGION}.console.aws.amazon.com/s3/buckets/{PROD_S3_BACKUPS}?region={REGION}&prefix=models/{model_ver}/)) |")
    lines.append("| **Local Model & Manifest** | • [`live_win_predictor_model.joblib`](../apps/ml-engine/live_win_predictor_model.joblib)<br/>• [`model_manifest.json`](../apps/ml-engine/model_manifest.json)<br/>• [`live_metadata.json`](../apps/ml-engine/live_metadata.json) |")
    lines.append(f"| **SHA-256 Checksum** | `{ML_LIVE_META.get('sha256', 'de9e39513fbac895df7c86c449ef0a6b687717b5d1f40af08b5a5b13aa37c0cf')}` |")
    lines.append(f"| **DVC Dataset Lineage** | `{ML_MANIFEST.get('datasetVersion', 'dvc:31e19c47bdbc05d773938754d8589516')}` (`cricket-data/t20s_json.zip.dvc`, `dvc.yaml`, `dvc.lock`) |")
    lines.append("| **ECR Container Optimization** | `public.ecr.aws/lambda/python:3.12` + `xgboost-cpu` (`~309 MB`, `countNumber = 1` single-image retention) |")
    lines.append(f"| **Dev ECR Image (`:{model_ver}`)** | • Size: `{DEV_ECR_IMG['size_mb']} MB`<br/>• Digest: `{DEV_ECR_IMG['digest']}`<br/>• Pushed: `{DEV_ECR_IMG['pushed']}` |")
    lines.append(f"| **Prod ECR Image (`:{model_ver}`)** | • Size: `{PROD_ECR_IMG['size_mb']} MB`<br/>• Digest: `{PROD_ECR_IMG['digest']}`<br/>• Pushed: `{PROD_ECR_IMG['pushed']}` |")
    lines.append("")

    lines.append("### Champion vs. Baseline Benchmark Metrics")
    val_m = ML_MANIFEST.get("evaluationMetrics", {}).get("validation", {})
    test_m = ML_MANIFEST.get("evaluationMetrics", {}).get("test", {})
    base_m = ML_MANIFEST.get("evaluationMetrics", {}).get("baselineLogisticRegressionVal", {})
    lines.append("| Metric | Champion XGBoost (`v2.2.0`) | Baseline Logistic Reg (`v1.0.0`) | Improvement |")
    lines.append("|---|---|---|---|")
    lines.append(f"| **Validation Log Loss** | **`{val_m.get('log_loss', 0.5786)}`** | `{base_m.get('log_loss', 0.8069)}` | **-28.3% (Superior probability calibration)** |")
    lines.append(f"| **Test Log Loss** | **`{test_m.get('log_loss', 0.6018)}`** | — | **Stable out-of-sample generalization** |")
    lines.append(f"| **Validation Accuracy** | **`{round(val_m.get('accuracy', 0.6835)*100, 2)}%`** | `{round(base_m.get('accuracy', 0.6559)*100, 2)}%` | **+2.76% raw gain** |")
    lines.append(f"| **Test Accuracy** | **`{round(test_m.get('accuracy', 0.6901)*100, 2)}%`** | — | **Consistent match outcome classification** |")
    lines.append(f"| **Validation ROC-AUC** | **`{val_m.get('roc_auc', 0.7723)}`** | `{base_m.get('roc_auc', 0.7550)}` | **+0.0173 discrimination power** |")
    lines.append(f"| **Test ROC-AUC** | **`{test_m.get('roc_auc', 0.7529)}`** | — | **Strong unseen match ranking** |")
    lines.append(f"| **Brier Score** | **`{val_m.get('brier_score', 0.1992)}`** | `{base_m.get('brier_score', 0.2379)}` | **-16.3% lower error variance** |")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Database & Vectors Section
    lines.append("## 🗄️ Database, Vectors & RAG Architecture (Aiven PostgreSQL)")
    lines.append("")
    lines.append("| Component | Configuration / Schema Details |")
    lines.append("|---|---|")
    lines.append(f"| **Managed PostgreSQL 16** | • Host: `{DB_HOST}`<br/>• Port: `{DB_PORT}`<br/>• Database: `{DB_NAME}`<br/>• Console: [Aiven Console](https://console.aiven.io/) |")
    lines.append("| **Schema Isolation & TLS** | Isolated `dev` and `prod` schemas (`SET search_path`) over `sslmode=require` (`pg.Pool` max 5 connections) |")
    lines.append("| **Core Relational Tables** | `matches` (includes `ai_summary`, `player_of_the_match`), `innings`, `players`, `bowlers`, `balls` |")
    lines.append("| **Vector RAG Table (`pgvector`)** | `tournament_rules` (`vector(1536)` embeddings + HNSW cosine index `vector_cosine_ops`) |")
    lines.append("| **Database Migrations** | • [`infra/database/schema.sql`](../infra/database/schema.sql)<br/>• [`infra/database/migrations/`](../infra/database/migrations/) |")
    lines.append("| **4 MCP Specialist Tools** | • `execute_sql` (Match Stats)<br/>• `search_tournament_rules` (`pgvector` RAG)<br/>• `get_match_weather` (Open-Meteo)<br/>• `create_github_issue` (GitHub API) |")
    lines.append("| **AI Documentation** | • [`ai_architecture.md`](./ai_architecture.md)<br/>• [`weather_report_agent.md`](./weather_report_agent.md)<br/>• [`github_issue_agent.md`](./github_issue_agent.md) |")
    lines.append("")
    lines.append("---")
    lines.append("")

    # S3 Storage Section
    lines.append("## 📦 Storage, S3 Buckets & Terraform State")
    lines.append("")
    lines.append("| Purpose | Environment | Bucket Name | AWS Console Direct Link |")
    lines.append("|---|---|---|---|")
    lines.append(f"| **Static Web Hosting** | DEV | `{DEV_S3_APP}` | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/{DEV_S3_APP}?region={REGION}) |")
    lines.append(f"| **Static Web Hosting** | PROD | `{PROD_S3_APP}` | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/{PROD_S3_APP}?region={REGION}) |")
    lines.append(f"| **Match Event Backups** | DEV | `{DEV_S3_BACKUPS}` | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/{DEV_S3_BACKUPS}?region={REGION}) |")
    lines.append(f"| **Match Event Backups** | PROD | `{PROD_S3_BACKUPS}` | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/{PROD_S3_BACKUPS}?region={REGION}) |")
    lines.append(f"| **CloudFront CDN Logs** | DEV | `{DEV_S3_LOGS}` | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/{DEV_S3_LOGS}?region={REGION}) |")
    lines.append(f"| **CloudFront CDN Logs** | PROD | `{PROD_S3_LOGS}` | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/{PROD_S3_LOGS}?region={REGION}) |")
    lines.append(f"| **Terraform Remote State** | GLOBAL | `{STATE_BUCKET}` | [Open Bucket](https://s3.console.aws.amazon.com/s3/buckets/{STATE_BUCKET}?region={REGION}) |")
    lines.append("")
    lines.append(f"- **Dev Terraform State Key**: `s3://{STATE_BUCKET}/cricscore/dev/terraform.tfstate`")
    lines.append(f"- **Prod Terraform State Key**: `s3://{STATE_BUCKET}/cricscore/prod/terraform.tfstate`")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Security & CI/CD Scans Section
    lines.append("## 🛡️ Security Posture, SBOM & CI/CD Scans")
    lines.append("")
    lines.append("| Scanner / Guardrail | Scope | Console / Workflow Link |")
    lines.append("|---|---|---|")
    lines.append(f"| **CodeQL SAST** | JavaScript, TypeScript & Python static analysis | [Code Scanning Console](https://github.com/{GITHUB_REPO}/security/code-scanning) |")
    lines.append(f"| **Dependabot SCA** | Automated npm, pip & GitHub Actions dependency updates | [Dependabot Alerts](https://github.com/{GITHUB_REPO}/security/dependabot) |")
    lines.append(f"| **GitLeaks** | Secret detection on every commit and PR | [`ci.yml`](https://github.com/{GITHUB_REPO}/actions/workflows/ci.yml) |")
    lines.append(f"| **Trivy** | Filesystem & container HIGH/CRITICAL CVE scans | [`ci.yml`](https://github.com/{GITHUB_REPO}/actions/workflows/ci.yml) |")
    lines.append(f"| **Checkov** | Terraform IaC security & compliance checks | [`ci.yml`](https://github.com/{GITHUB_REPO}/actions/workflows/ci.yml) |")
    lines.append(f"| **Syft SPDX SBOM** | Software Bill of Materials (`spdx-json` artifact) | [`sbom.yml`](https://github.com/{GITHUB_REPO}/actions/workflows/sbom.yml) |")
    lines.append(f"| **OWASP ZAP (DAST)** | Live baseline dynamic security scan on `dev` & `prod` | • [`ci.yml`](https://github.com/{GITHUB_REPO}/actions/workflows/ci.yml)<br/>• [`cd.yml`](https://github.com/{GITHUB_REPO}/actions/workflows/cd.yml) |")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Observability Section
    lines.append("## 📊 Observability, Tracing & Alarms (AWS X-Ray & CloudWatch)")
    lines.append("")
    lines.append("| Telemetry Surface | Retention / Sampling | AWS Console Link |")
    lines.append("|---|---|---|")
    lines.append(f"| **CloudWatch Log Groups** | **7-day retention** across all API Gateway & Lambda logs | [Open Log Groups](https://{REGION}.console.aws.amazon.com/cloudwatch/home?region={REGION}#logsV2:log-groups) |")
    lines.append(f"| **CloudWatch Metrics** | API Gateway requests, Lambda durations, SQS FIFO depth | [Open Metrics](https://{REGION}.console.aws.amazon.com/cloudwatch/home?region={REGION}#metricsV2) |")
    lines.append(f"| **AWS X-Ray Service Map** | **5% trace sampling** (`1 req/s` reservoir) across all 9 Lambdas | [Open Service Map](https://{REGION}.console.aws.amazon.com/cloudwatch/home?region={REGION}#xray:service-map/map) |")
    lines.append(f"| **AWS X-Ray Traces** | End-to-end waterfall latency analysis | [Open X-Ray Traces](https://{REGION}.console.aws.amazon.com/cloudwatch/home?region={REGION}#xray:traces/query) |")
    lines.append(f"| **CloudWatch Alarms** | `match-api` & `score-upd` error alerts via SNS email | [Open Alarms](https://{REGION}.console.aws.amazon.com/cloudwatch/home?region={REGION}#alarmsV2:) |")
    lines.append("")

    return "\n".join(lines)

def main():
    doc_path = REPO_ROOT / "docs" / "platform_dashboard.md"
    legacy_doc_path = REPO_ROOT / "docs" / "aws_resources_dashboard.md"
    content = build_markdown()
    
    doc_path.write_text(content)
    # Also write to legacy path so existing links never break
    legacy_doc_path.write_text(content)

    for p in [doc_path, legacy_doc_path]:
        subprocess.run(
            ["npx", "prettier", "--write", str(p)],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            cwd=REPO_ROOT
        )
    print(f"✅ CricScore Central Platform Dashboard successfully generated at {doc_path} and {legacy_doc_path}")

if __name__ == "__main__":
    main()
