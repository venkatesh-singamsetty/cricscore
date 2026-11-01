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

STATE_BUCKET="${TF_STATE_BUCKET:-}"
if [[ -z "$STATE_BUCKET" ]]; then
  STATE_BUCKET="${PROJECT_NAME:-cricscore}-tfstate-$(aws sts get-caller-identity --query Account --output text)"
fi
if [[ "$STATE_BUCKET" == *yourname* || "$STATE_BUCKET" == *example* ]]; then
  echo "❌ Replace the example TF_STATE_BUCKET in .env.local before configuring GitHub Environments." >&2
  exit 1
fi

# Set Secrets (same for both for now, schema isolates data)
gh secret set TF_DATABASE_URL -b"$TF_DATABASE_URL" --env dev
gh secret set TF_DATABASE_URL -b"$TF_DATABASE_URL" --env prod

gh secret set TF_SES_SOURCE_EMAIL -b"$TF_SES_SOURCE_EMAIL" --env dev
gh secret set TF_SES_SOURCE_EMAIL -b"$TF_SES_SOURCE_EMAIL" --env prod

# Aiven PostgreSQL Root CA certificate for strict SSL verification
CA_CERT_FILE="infra/database/certs/aiven-ca.pem"
CA_CERT_VALUE="${AIVEN_CA_CERT:-}"
if [[ -z "$CA_CERT_VALUE" && -f "$CA_CERT_FILE" ]]; then
  CA_CERT_VALUE="$(cat "$CA_CERT_FILE")"
fi
if [[ -n "$CA_CERT_VALUE" ]]; then
  gh secret set AIVEN_CA_CERT -b"$CA_CERT_VALUE" --env dev
  gh secret set AIVEN_CA_CERT -b"$CA_CERT_VALUE" --env prod
  gh secret set AIVEN_CA_CERT -b"$CA_CERT_VALUE"
  echo "✅ Configured Aiven Root CA certificate (AIVEN_CA_CERT) in dev, prod, and repository secrets"
fi

# Configure AWS Credentials: Prefer keyless GitHub Actions OIDC (AWS_ROLE_ARN)
# over legacy static keys.
if [[ -n "${AWS_ROLE_ARN:-}" ]]; then
  gh variable set AWS_ROLE_ARN -b "$AWS_ROLE_ARN"
  for ENV in dev prod; do
    gh variable set AWS_ROLE_ARN -b "$AWS_ROLE_ARN" --env "$ENV"
  done
  echo "✅ Configured keyless GitHub Actions OIDC role (AWS_ROLE_ARN: $AWS_ROLE_ARN)"
elif [[ -n "${AWS_ACCESS_KEY_ID:-}" && -n "${AWS_SECRET_ACCESS_KEY:-}" ]]; then
  for ENV in dev prod; do
    gh secret set AWS_ACCESS_KEY_ID -b"$AWS_ACCESS_KEY_ID" --env "$ENV"
    gh secret set AWS_SECRET_ACCESS_KEY -b"$AWS_SECRET_ACCESS_KEY" --env "$ENV"
  done
  echo "⚠️ Configured legacy static AWS credentials; run ./infra/scripts/bootstrap_oidc.sh to upgrade to OIDC."
else
  echo "⚠️ Neither AWS_ROLE_ARN nor AWS_ACCESS_KEY_ID found; run ./infra/scripts/bootstrap_oidc.sh to configure keyless OIDC."
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
gh variable set TF_STATE_BUCKET -b"$STATE_BUCKET" --env dev
gh variable set TF_STATE_BUCKET -b"$STATE_BUCKET" --env prod

# Set environment-specific variables
for ENV in dev prod; do
  ZONE="${ZONE_DOMAIN:-}"
  BASE_PREFIX="${SUBDOMAIN_PREFIX:-cricscore}"
  BASE_PROJECT="${PROJECT_NAME:-cricscore}"

  if [[ "$ENV" == "dev" ]]; then
    DOMAIN="${DEV_DOMAIN_NAME:-${BASE_PREFIX}dev.${ZONE}}"
    PREFIX="${DEV_SUBDOMAIN_PREFIX:-${BASE_PREFIX}dev}"
    PROJ="${DEV_PROJECT_NAME:-${BASE_PROJECT}dev}"
  else
    DOMAIN="${PROD_DOMAIN_NAME:-${DOMAIN_NAME:-${BASE_PREFIX}.${ZONE}}}"
    PREFIX="${PROD_SUBDOMAIN_PREFIX:-$BASE_PREFIX}"
    PROJ="${PROD_PROJECT_NAME:-$BASE_PROJECT}"
  fi

  if [[ -z "$ZONE" || -z "$DOMAIN" || "$DOMAIN" == *yourdomain* || "$ZONE" == *yourdomain* || "$DOMAIN" == *example.com* ]]; then
    echo "❌ Set your real ZONE_DOMAIN and environment domain values in .env.local before continuing." >&2
    exit 1
  fi

  gh variable set DOMAIN_NAME -b"$DOMAIN" --env "$ENV"
  gh variable set ZONE_DOMAIN -b"$ZONE" --env "$ENV"
  gh variable set SUBDOMAIN_PREFIX -b"$PREFIX" --env "$ENV"
  gh variable set PROJECT_NAME -b"$PROJ" --env "$ENV"

  if [[ -n "${LLM_BASE_URL:-}" ]]; then
    gh variable set LLM_BASE_URL -b"$LLM_BASE_URL" --env "$ENV"
  fi
  if [[ -n "${LLM_MODEL:-}" ]]; then
    gh variable set LLM_MODEL -b"$LLM_MODEL" --env "$ENV"
  fi

  echo "✅ Populated variables for $ENV environment"
done

echo "✅ GitHub Environments setup complete."
