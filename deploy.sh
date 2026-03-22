#!/bin/bash
set -e

# 1. Build the app
echo "🚀 Building the application..."
npm run build

# 2. Go into terraform dir
cd terraform

# 3. Initialize & Apply infrastructure
echo "⚙️ Initializing & Upgrading Terraform..."
terraform init -reconfigure -upgrade

echo "☁️ Applying AWS Infrastructure (S3, CloudFront, Route53, ACM)..."
terraform apply -auto-approve

# 4. Get the bucket name
BUCKET_NAME=$(terraform output -raw s3_bucket_name)

# 5. Sync files
echo "📦 Syncing files to S3 bucket: $BUCKET_NAME..."
aws s3 sync ../dist/ s3://$BUCKET_NAME/ --delete

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
