#!/bin/bash
set -euo pipefail

# Optional flags
USE_LOCAL_ENV=false
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --use-local-env)
      USE_LOCAL_ENV=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [--use-local-env]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

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

# 1. Install Dependencies
echo "📦 Installing required frontend dependencies..."
(cd frontend && npm install)

echo "📦 Installing required Lambda dependencies..."
for dir in backend/lambdas/*/; do
  if [ -f "$dir/package.json" ]; then
    echo "Hydrating $dir..."
    (cd "$dir" && npm install --production)
  fi
done

# 2. Apply Infrastructure first to get correct API Gateway URLs
echo "⚙️ Initializing & Upgrading Terraform..."
(cd terraform && terraform init -reconfigure -upgrade)

echo "☁️ Applying AWS Infrastructure (S3, CloudFront, Route53, ACM, API Gateway)..."
(cd terraform && terraform apply -auto-approve)

# 3. Read Terraform outputs
echo "🔍 Querying Terraform outputs..."
API_URL=$(cd terraform && terraform output -raw http_api_url)
WS_URL=$(cd terraform && terraform output -raw websocket_url)

echo "⚙️ Synchronizing frontend environment variables..."
cat <<EOF > frontend/.env
VITE_API_URL=$API_URL
VITE_WS_URL=$WS_URL
VITE_ADMIN_PIN=${VITE_ADMIN_PIN:-2403}
EOF

if [ -z "${VITE_ADMIN_PIN:-}" ]; then
  echo "WARNING: VITE_ADMIN_PIN is not set; using default (2403). Consider setting VITE_ADMIN_PIN as an env var or GitHub secret." >&2
fi

# 4. Build the application with the correct variables
echo "🚀 Building the frontend application..."
(unset VITE_API_URL VITE_WS_URL VITE_ADMIN_PIN VITE_SCORER_PIN; cd frontend && npm run build)

# 5. Sync files to S3
cd terraform
BUCKET_NAME=$(terraform output -raw s3_bucket_name)
echo "📦 Syncing files to S3 bucket: $BUCKET_NAME..."
aws s3 sync ../frontend/dist/ s3://$BUCKET_NAME/ --delete

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
