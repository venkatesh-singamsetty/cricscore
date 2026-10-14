#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/../.."

# Get current repository dynamically
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

# Ensure environments exist
gh api -X PUT repos/$REPO/environments/dev >/dev/null
gh api -X PUT repos/$REPO/environments/prod >/dev/null

echo "✅ Created environments 'dev' and 'prod'"

# Source base env local
if [ -f ".env.local" ]; then
  set -a
  . ./.env.local
  set +a
fi

# Set Secrets (same for both for now, schema isolates data)
gh secret set TF_DATABASE_URL -b"$TF_DATABASE_URL" --env dev
gh secret set TF_DATABASE_URL -b"$TF_DATABASE_URL" --env prod

gh secret set TF_SES_SOURCE_EMAIL -b"$TF_SES_SOURCE_EMAIL" --env dev
gh secret set TF_SES_SOURCE_EMAIL -b"$TF_SES_SOURCE_EMAIL" --env prod

# The current GitHub workflows use static AWS credentials. Prefer OIDC when the
# repository IAM role and workflow are migrated to support it.
if [[ -n "${AWS_ACCESS_KEY_ID:-}" && -n "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
  for ENV in dev prod; do
    gh secret set AWS_ACCESS_KEY_ID -b"$AWS_ACCESS_KEY_ID" --env "$ENV"
    gh secret set AWS_SECRET_ACCESS_KEY -b"$AWS_SECRET_ACCESS_KEY" --env "$ENV"
  done
else
  echo "⚠️ AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY not found in environment; add deployment credentials to each GitHub Environment."
fi

LLM_SECRET="${OPENAI_API_KEY:-${LLM_API_KEY:-}}"
if [[ -n "$LLM_SECRET" ]]; then
  for ENV in dev prod; do
    gh secret set OPENAI_API_KEY -b"$LLM_SECRET" --env "$ENV"
  done
else
  echo "⚠️ No OPENAI_API_KEY or LLM_API_KEY found; add OPENAI_API_KEY to each GitHub Environment if chat is enabled."
fi

# Set common variables
gh variable set AWS_REGION -b"$AWS_REGION" --env dev
gh variable set AWS_REGION -b"$AWS_REGION" --env prod
gh variable set ADMIN_EMAIL -b"$ADMIN_EMAIL" --env dev
gh variable set ADMIN_EMAIL -b"$ADMIN_EMAIL" --env prod

# Set environment-specific variables
for ENV in dev prod; do
  TFVARS="infra/terraform/environments/${ENV}.tfvars"
  
  if [ -f "$TFVARS" ]; then
    DOMAIN=$(grep '^domain_name' "$TFVARS" | awk -F'"' '{print $2}')
    ZONE=$(grep '^zone_domain' "$TFVARS" | awk -F'"' '{print $2}')
    PREFIX=$(grep '^subdomain_prefix' "$TFVARS" | awk -F'"' '{print $2}')
    PROJ=$(grep '^project_name' "$TFVARS" | awk -F'"' '{print $2}')
    
    gh variable set DOMAIN_NAME -b"$DOMAIN" --env $ENV
    gh variable set ZONE_DOMAIN -b"$ZONE" --env $ENV
    gh variable set SUBDOMAIN_PREFIX -b"$PREFIX" --env $ENV
    gh variable set PROJECT_NAME -b"$PROJ" --env $ENV

    # Deployment jobs sync the built SPA and invalidate the matching CDN.
    terraform -chdir=infra/terraform init -input=false -reconfigure \
      -backend-config="key=cricscore/${ENV}/terraform.tfstate" >/dev/null
    S3_BUCKET=$(terraform -chdir=infra/terraform output -raw s3_bucket_name)
    CLOUDFRONT_DISTRIBUTION_ID=$(terraform -chdir=infra/terraform output -raw cloudfront_distribution_id)
    gh variable set S3_BUCKET -b"$S3_BUCKET" --env "$ENV"
    gh variable set CLOUDFRONT_DISTRIBUTION_ID -b"$CLOUDFRONT_DISTRIBUTION_ID" --env "$ENV"

    if [[ -n "${LLM_BASE_URL:-}" ]]; then
      gh variable set LLM_BASE_URL -b"$LLM_BASE_URL" --env "$ENV"
    fi
    if [[ -n "${LLM_MODEL:-}" ]]; then
      gh variable set LLM_MODEL -b"$LLM_MODEL" --env "$ENV"
    fi
    
    echo "✅ Populated variables for $ENV environment"
  fi
done

echo "✅ GitHub Environments setup complete."
