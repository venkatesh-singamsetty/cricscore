#!/bin/bash
set -e

echo "🚀 Starting Local Deployment to PROD..."

# Load local environment variables
if [ -f ".env.local" ]; then
  echo "Loading variables from .env.local..."
  export $(grep -v '^#' .env.local | xargs)
else
  echo "❌ .env.local not found!"
  exit 1
fi

export TF_VAR_environment="prod"
export TF_VAR_database_url="$TF_DATABASE_URL"
export TF_VAR_ses_source_email="$TF_SES_SOURCE_EMAIL"
export TF_VAR_admin_email="$ADMIN_EMAIL"
export TF_VAR_llm_api_key="$OPENROUTER_API_KEY"
export TF_VAR_llm_base_url="https://openrouter.ai/api/v1"

echo "🗄️ Running DB Migrations..."
(cd infra/database && ./migrate.sh "$TF_DATABASE_URL" "prod")

echo "📦 Installing Lambda dependencies..."
for d in apps/backend/lambdas/*; do
  if [ -f "$d/package.json" ]; then
    (cd "$d" && npm install --omit=dev --ignore-scripts)
  fi
done

echo "🏗️ Applying Terraform (PROD)..."
cd infra/terraform
terraform init -reconfigure -backend-config="key=cricscore/prod/terraform.tfstate"
terraform apply -var-file="environments/prod.tfvars" -auto-approve
cd ../../

echo "🌐 Getting AWS outputs for frontend..."
API_GATEWAY_ID=$(aws apigatewayv2 get-apis --query "Items[?Name=='cricscore-api'].ApiId" --output text | head -n 1)
WS_API_GATEWAY_ID=$(aws apigatewayv2 get-apis --query "Items[?Name=='cricscore-websocket-api'].ApiId" --output text | head -n 1)
CLOUDFRONT_DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items!=null] | [?contains(Aliases.Items, 'cricscore.venkateshsingamsetty.site')].Id" --output text | head -n 1)
S3_BUCKET=$(cd infra/terraform && terraform output -raw s3_bucket_name)

export VITE_APP_TITLE="CricScore"
export VITE_API_URL="https://${API_GATEWAY_ID}.execute-api.us-east-1.amazonaws.com"
export VITE_WS_URL="wss://${WS_API_GATEWAY_ID}.execute-api.us-east-1.amazonaws.com/prod"
export VITE_ADMIN_PIN="1234" # Or fetch from secrets

echo "VITE_API_URL: $VITE_API_URL"
echo "VITE_WS_URL: $VITE_WS_URL"

echo "🎨 Building Frontend..."
cd apps/frontend
npm run build
cd ../../

echo "☁️ Uploading to S3 ($S3_BUCKET)..."
aws s3 sync apps/frontend/dist/ s3://${S3_BUCKET}/ --delete --cache-control "public,max-age=31536000,immutable" --exclude "index.html"
aws s3 cp apps/frontend/dist/index.html s3://${S3_BUCKET}/index.html --cache-control "no-cache,no-store,must-revalidate" --content-type "text/html"

echo "🧹 Invalidating CloudFront Cache ($CLOUDFRONT_DISTRIBUTION_ID)..."
aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths "/*"

echo "✅ Local PROD Deployment Complete!"
