#!/bin/bash
# scripts/terraform.sh
# Wrapper that sources .env.local and runs Terraform with TF_VAR_* env vars.
# Usage: ./scripts/terraform.sh [plan|apply|destroy|...]
# This mirrors exactly what CI does — no need for a terraform.tfvars file.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.local"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env.local not found at $REPO_ROOT. Copy .env.local.example and fill in your values."
    exit 1
fi

# Source .env.local and export variables
set -o allexport
source "$ENV_FILE"
set +o allexport

# Map TF_* prefixed vars from .env.local to Terraform's TF_VAR_* convention
export TF_VAR_database_url="${TF_DATABASE_URL}"
export TF_VAR_ses_source_email="${TF_SES_SOURCE_EMAIL}"
export TF_VAR_admin_email="${ADMIN_EMAIL}"
export TF_VAR_domain_name="${DOMAIN_NAME}"
export TF_VAR_zone_domain="${ZONE_DOMAIN}"
export TF_VAR_subdomain_prefix="${SUBDOMAIN_PREFIX:-cricscore}"
export TF_VAR_project_name="${PROJECT_NAME:-cricscore}"
export TF_VAR_aws_region="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-${AWS_REGION:-us-east-1}}"

echo "🌍 Running: terraform -chdir=$REPO_ROOT/terraform $*"
echo "   domain_name      = $TF_VAR_domain_name"
echo "   ses_source_email = $TF_VAR_ses_source_email"
echo "   admin_email      = $TF_VAR_admin_email"
echo ""

terraform -chdir="$REPO_ROOT/terraform" "$@"
