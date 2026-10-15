#!/bin/bash
set -euo pipefail

# Ensure script executes from repository root
cd "$(dirname "$0")/../.."

# Optional flags
USE_LOCAL_ENV=false
BOOTSTRAP=false
BOOTSTRAP_ONLY=false
RUN_MIGRATIONS=false
CHECK_ONLY=false
ENV_FILE=""
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --use-local-env)
      USE_LOCAL_ENV=true
      shift
      ;;
    --bootstrap)
      BOOTSTRAP=true
      shift
      ;;
    --bootstrap-only)
      BOOTSTRAP=true
      BOOTSTRAP_ONLY=true
      shift
      ;;
    --migrate)
      RUN_MIGRATIONS=true
      shift
      ;;
    --check)
      CHECK_ONLY=true
      shift
      ;;
    --env)
      ENV_FILE="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 --env dev|prod [--use-local-env] [--bootstrap | --bootstrap-only] [--migrate] [--check]"
      echo "  --bootstrap       Create the state bucket and Route 53 zone, then continue deployment."
      echo "  --bootstrap-only  Create the state bucket and Route 53 zone, print nameservers, then exit."
      echo "  --check           Verify tools, AWS login and .env.local, then exit without changing anything."
      echo "  --migrate    Run the selected environment's database migrations."
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "$ENV_FILE" ]; then
  echo "Error: --env [dev|prod] is required." >&2
  exit 1
fi

if [[ "$ENV_FILE" != "dev" && "$ENV_FILE" != "prod" ]]; then
  echo "Error: --env must be dev or prod." >&2
  exit 1
fi

# If requested, load variables from local .env.local into the environment
if [ "$USE_LOCAL_ENV" = true ]; then
  if [ -f ".env.local" ]; then
    echo "📥 Loading local environment from .env.local (only for this shell session)..."
    set -a
    . ./.env.local
    set +a
  else
    echo "⚠️  --use-local-env requested but .env.local not found; continuing." >&2
  fi
fi

# Derive per-environment names from the root project/domain settings, with
# explicit overrides available for non-standard naming.
STATE_BUCKET="${TF_STATE_BUCKET:-}"
if [[ -z "$STATE_BUCKET" ]]; then
  ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text 2>/dev/null || true)"
  if [[ -z "$ACCOUNT_ID" ]]; then
    echo "Error: set TF_STATE_BUCKET in .env.local, or configure AWS credentials so a default name can be derived." >&2
    exit 1
  fi
  STATE_BUCKET="${PROJECT_NAME:-cricscore}-tfstate-${ACCOUNT_ID}"
  echo "ℹ️  TF_STATE_BUCKET not set; using ${STATE_BUCKET}"
fi
ZONE_DOMAIN="${ZONE_DOMAIN:-}"
BASE_DOMAIN="${DOMAIN_NAME:-}"
BASE_PREFIX="${SUBDOMAIN_PREFIX:-cricscore}"
BASE_PROJECT="${PROJECT_NAME:-cricscore}"

if [[ "$ENV_FILE" == "dev" ]]; then
  DEPLOY_DOMAIN="${DEV_DOMAIN_NAME:-}"
  [[ -n "$DEPLOY_DOMAIN" ]] || DEPLOY_DOMAIN="${BASE_PREFIX}dev.${ZONE_DOMAIN}"
  DEPLOY_PREFIX="${DEV_SUBDOMAIN_PREFIX:-${BASE_PREFIX}dev}"
  DEPLOY_PROJECT="${DEV_PROJECT_NAME:-${BASE_PROJECT}dev}"
else
  DEPLOY_DOMAIN="${PROD_DOMAIN_NAME:-$BASE_DOMAIN}"
  [[ -n "$DEPLOY_DOMAIN" ]] || DEPLOY_DOMAIN="${BASE_PREFIX}.${ZONE_DOMAIN}"
  DEPLOY_PREFIX="${PROD_SUBDOMAIN_PREFIX:-$BASE_PREFIX}"
  DEPLOY_PROJECT="${PROD_PROJECT_NAME:-$BASE_PROJECT}"
fi

if [[ -z "$ZONE_DOMAIN" || -z "$DEPLOY_DOMAIN" ]]; then
  echo "Error: set ZONE_DOMAIN and DOMAIN_NAME in .env.local (or the matching per-environment overrides)." >&2
  exit 1
fi
if [[ "$DEPLOY_DOMAIN" != *."$ZONE_DOMAIN" ]]; then
  echo "Error: ${DEPLOY_DOMAIN} must be a subdomain of the configured Route 53 zone ${ZONE_DOMAIN}." >&2
  exit 1
fi
if [[ "$STATE_BUCKET" == *yourname* || "$STATE_BUCKET" == *example* || "$ZONE_DOMAIN" == *yourdomain* || "$ZONE_DOMAIN" == "example.com" || "$DEPLOY_DOMAIN" == *yourdomain* || "$DEPLOY_DOMAIN" == *example.com* ]]; then
  echo "Error: replace example domain and TF_STATE_BUCKET values in .env.local before deploying." >&2
  exit 1
fi

if [[ "$CHECK_ONLY" == true ]]; then
  FAIL=0
  for t in node terraform aws jq docker psql; do
    if command -v "$t" >/dev/null 2>&1; then echo "✅ $t"; else echo "❌ $t missing (run ./infra/scripts/setup.sh)"; FAIL=1; fi
  done
  if aws sts get-caller-identity >/dev/null 2>&1; then echo "✅ AWS credentials"; else echo "❌ AWS credentials invalid"; FAIL=1; fi
  if docker info >/dev/null 2>&1; then echo "✅ Docker running"; else echo "❌ Docker not running"; FAIL=1; fi
  for v in TF_DATABASE_URL TF_SES_SOURCE_EMAIL ADMIN_EMAIL OPENAI_API_KEY; do
    if [[ -z "${!v:-}" || "${!v}" == *your* ]]; then echo "❌ $v not set in .env.local"; FAIL=1; else echo "✅ $v"; fi
  done
  [[ "$FAIL" == 0 ]] && echo "🚀 Ready to deploy." || echo "Fix the items above, then re-run."
  exit "$FAIL"
fi

# Auto-map GitHub-style variables to Terraform variables for a seamless local experience
if [ -n "${TF_DATABASE_URL:-}" ]; then export TF_VAR_database_url="$TF_DATABASE_URL"; fi
if [ -n "${TF_SES_SOURCE_EMAIL:-}" ]; then export TF_VAR_ses_source_email="$TF_SES_SOURCE_EMAIL"; fi
if [ -n "${AWS_REGION:-}" ]; then export TF_VAR_aws_region="$AWS_REGION"; fi
if [ -n "${ADMIN_EMAIL:-}" ]; then export TF_VAR_admin_email="$ADMIN_EMAIL"; fi
if [ -n "${LLM_API_KEY:-}" ]; then export TF_VAR_llm_api_key="$LLM_API_KEY"; fi
if [ -n "${OPENAI_API_KEY:-}" ]; then export TF_VAR_openai_api_key="$OPENAI_API_KEY"; fi
if [ -n "${LLM_BASE_URL:-}" ]; then export TF_VAR_llm_base_url="$LLM_BASE_URL"; fi
if [ -n "${LLM_MODEL:-}" ]; then export TF_VAR_llm_model="$LLM_MODEL"; fi

if [[ "$BOOTSTRAP" == true ]]; then
  echo "🏗️ Bootstrapping the Terraform state bucket and Route 53 zone..."
  terraform -chdir=infra/terraform/bootstrap init -input=false
  terraform -chdir=infra/terraform/bootstrap apply -input=false -auto-approve \
    -var="aws_region=${AWS_REGION:-us-east-1}" \
    -var="state_bucket_name=${STATE_BUCKET}" \
    -var="domain_name=${ZONE_DOMAIN}"
  if [[ "$BOOTSTRAP_ONLY" == true ]]; then
    echo "🌐 Add these Route 53 nameservers at your domain registrar before deploying:"
    terraform -chdir=infra/terraform/bootstrap output -json route53_name_servers
    exit 0
  fi
fi

if [[ "$RUN_MIGRATIONS" == true ]]; then
  if [[ -z "${TF_DATABASE_URL:-}" ]]; then
    echo "Error: --migrate requires TF_DATABASE_URL in .env.local." >&2
    exit 1
  fi
  if ! command -v psql >/dev/null 2>&1; then
    echo "Error: --migrate requires the PostgreSQL client (psql)." >&2
    exit 1
  fi
  echo "🗄️ Running database migrations for ${ENV_FILE}..."
  (cd infra/database && ./migrate.sh "$TF_DATABASE_URL" "$ENV_FILE")
fi
# 1. Install Dependencies
echo "📦 Installing required frontend dependencies..."
(cd apps/frontend && npm install --ignore-scripts)

echo "📦 Installing required Lambda dependencies..."
for dir in apps/backend/lambdas/*/; do
  if [ -f "$dir/package.json" ]; then
    echo "Hydrating $dir..."
    (cd "$dir" && npm install --omit=dev --ignore-scripts)
  fi
done

# 2. Apply Infrastructure first to get correct API Gateway URLs
echo "⚙️ Initializing & Upgrading Terraform..."
(cd infra/terraform && terraform init -reconfigure -upgrade \
  -backend-config="bucket=${STATE_BUCKET}" \
  -backend-config="key=cricscore/${ENV_FILE}/terraform.tfstate")

echo "☁️ Applying AWS Infrastructure for $ENV_FILE environment..."
(cd infra/terraform && terraform apply -var-file="environments/$ENV_FILE.tfvars" -auto-approve \
  -var="domain_name=${DEPLOY_DOMAIN}" \
  -var="zone_domain=${ZONE_DOMAIN}" \
  -var="project_name=${DEPLOY_PROJECT}" \
  -var="subdomain_prefix=${DEPLOY_PREFIX}")

# 3. Read Terraform outputs
echo "🔍 Querying Terraform outputs..."
API_URL=$(cd infra/terraform && terraform output -raw http_api_url)
WS_URL=$(cd infra/terraform && terraform output -raw websocket_url)
COGNITO_USER_POOL_ID=$(cd infra/terraform && terraform output -raw cognito_user_pool_id)
COGNITO_CLIENT_ID=$(cd infra/terraform && terraform output -raw cognito_client_id)
COGNITO_DOMAIN=$(cd infra/terraform && terraform output -raw cognito_domain)

echo "⚙️ Synchronizing frontend environment variables..."
# Preserve existing variables by only filtering out old auto-generated ones
if [ -f apps/frontend/.env ]; then
  grep -v "^VITE_API_URL=" apps/frontend/.env | \
  grep -v "^VITE_WS_URL=" | \
  grep -v "^VITE_APP_TITLE=" | \
  grep -v "^VITE_COGNITO_" > apps/frontend/.env.tmp || true
  mv apps/frontend/.env.tmp apps/frontend/.env
fi

if [ "$ENV_FILE" = "dev" ]; then
  APP_TITLE="CricScoreDev"
else
  APP_TITLE="CricScore"
fi

# Append the live AWS URLs to the end of the file
cat <<EOF >> apps/frontend/.env
VITE_API_URL=$API_URL
VITE_WS_URL=$WS_URL
VITE_APP_TITLE=$APP_TITLE
VITE_COGNITO_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
VITE_COGNITO_CLIENT_ID=$COGNITO_CLIENT_ID
VITE_COGNITO_DOMAIN=$COGNITO_DOMAIN
EOF

# 4. Build the application with the correct variables
echo "🚀 Building the frontend application..."
(unset VITE_API_URL VITE_WS_URL VITE_COGNITO_USER_POOL_ID VITE_COGNITO_CLIENT_ID VITE_COGNITO_DOMAIN; cd apps/frontend && npm run build)

# 5. Sync files to S3
cd infra/terraform
BUCKET_NAME=$(terraform output -raw s3_bucket_name)
echo "📦 Syncing files to S3 bucket: $BUCKET_NAME..."
aws s3 sync ../../apps/frontend/dist/ s3://$BUCKET_NAME/ --delete

echo "🔧 Setting Cache-Control headers on index.html to prevent stale mobile cache..."
aws s3 cp s3://$BUCKET_NAME/index.html s3://$BUCKET_NAME/index.html \
  --metadata-directive REPLACE \
  --cache-control "no-cache, no-store, must-revalidate" \
  --content-type "text/html"

# 6. Invalidate CloudFront
DIST_ID=$(terraform output -raw cloudfront_distribution_id)
if [ -n "$DIST_ID" ]; then
    echo "🔄 Invalidating CloudFront cache ($DIST_ID)..."
    aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*" --no-cli-pager
fi

# 7. Success message
WEBSITE_URL=$(terraform output -raw website_url)
echo "--------------------------------------------------------"
echo "✅ DEPLOYMENT SUCCESSFUL!"
echo "--------------------------------------------------------"
echo "Site is now live at: $WEBSITE_URL"
echo "--------------------------------------------------------"
