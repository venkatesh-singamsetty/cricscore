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
    
    echo "✅ Populated variables for $ENV environment"
  fi
done

echo "✅ GitHub Environments setup complete."
