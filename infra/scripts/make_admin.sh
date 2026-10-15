#!/bin/bash
# Add a signed-up user to the Cognito Admin group.
# Usage: ./infra/scripts/make_admin.sh --env dev|prod you@email.com
set -euo pipefail
cd "$(dirname "$0")/../.."

ENV_NAME=""
EMAIL=""
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --env) ENV_NAME="$2"; shift 2 ;;
    *) EMAIL="$1"; shift ;;
  esac
done
if [[ ( "$ENV_NAME" != "dev" && "$ENV_NAME" != "prod" ) || -z "$EMAIL" ]]; then
  echo "Usage: $0 --env dev|prod you@email.com" >&2
  exit 1
fi

if [ -f ".env.local" ]; then set -a; . ./.env.local; set +a; fi

BASE_PROJECT="${PROJECT_NAME:-cricscore}"
if [[ "$ENV_NAME" == "dev" ]]; then
  PROJECT="${DEV_PROJECT_NAME:-${BASE_PROJECT}dev}"
else
  PROJECT="${PROD_PROJECT_NAME:-$BASE_PROJECT}"
fi
REGION="${AWS_REGION:-us-east-1}"

POOL_ID="$(aws cognito-idp list-user-pools --max-results 60 --region "$REGION" \
  --query "UserPools[?Name=='${PROJECT}-user-pool'].Id | [0]" --output text)"
if [[ -z "$POOL_ID" || "$POOL_ID" == "None" ]]; then
  echo "Error: user pool ${PROJECT}-user-pool not found. Deploy first." >&2
  exit 1
fi

aws cognito-idp admin-add-user-to-group --region "$REGION" \
  --user-pool-id "$POOL_ID" --username "$EMAIL" --group-name Admin
echo "✅ $EMAIL is now an Admin in ${PROJECT}. Sign out and back in."
