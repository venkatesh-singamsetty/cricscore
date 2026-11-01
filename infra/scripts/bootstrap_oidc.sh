#!/usr/bin/env bash
# ==============================================================================
# CricScore - GitHub Actions OIDC (OpenID Connect) AWS Bootstrapper
# ==============================================================================
# This script performs the initial "Day 0" setup to migrate from static
# AWS access keys (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) to short-lived,
# passwordless OpenID Connect (OIDC) authentication for GitHub Actions.
#
# Prerequisites:
#   1. AWS CLI installed and configured with administrator credentials (e.g. user/venky).
#   2. GitHub CLI (gh) installed and authenticated (gh auth status).
#
# Usage:
#   ./infra/scripts/bootstrap_oidc.sh
# ==============================================================================

set -euo pipefail

ROLE_NAME="cricscore-github-actions-role"
OIDC_URL="https://token.actions.githubusercontent.com"
AUDIENCE="sts.amazonaws.com"
THUMBPRINTS=("6938fd4d98bab03faadb97b34396831e3780aea1" "1c5876bd52c07b75d732bed3138e21a6cbe3f2f1")

echo "=================================================================="
echo "🔐 CricScore GitHub Actions OIDC Bootstrap"
echo "=================================================================="

# 1. Verify Prerequisites
if ! command -v aws >/dev/null 2>&1; then
  echo "❌ Error: AWS CLI ('aws') is not installed or not in PATH."
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "❌ Error: GitHub CLI ('gh') is not installed or not in PATH."
  exit 1
fi

echo "🔍 Checking AWS credentials..."
CALLER_IDENTITY=$(aws sts get-caller-identity --output json 2>/dev/null || true)
if [ -z "$CALLER_IDENTITY" ]; then
  echo "❌ Error: Unable to authenticate with AWS. Run 'aws configure' with admin credentials."
  exit 1
fi

ACCOUNT_ID=$(echo "$CALLER_IDENTITY" | jq -r .Account)
CALLER_ARN=$(echo "$CALLER_IDENTITY" | jq -r .Arn)
echo "✅ Authenticated as: $CALLER_ARN (Account: $ACCOUNT_ID)"

echo "🔍 Checking GitHub CLI authentication..."
GITHUB_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
if [ -z "$GITHUB_REPO" ]; then
  echo "❌ Error: Not logged in to GitHub CLI or unable to determine repo. Run 'gh auth login'."
  exit 1
fi
echo "✅ Target GitHub Repository: $GITHUB_REPO"

# 2. Check / Create OpenID Connect Provider in AWS IAM
echo ""
echo "📡 Checking AWS IAM OpenID Connect Provider..."
PROVIDER_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

EXISTING_PROVIDER=$(aws iam list-open-id-connect-providers --query "OpenIDConnectProviderList[?Arn=='${PROVIDER_ARN}'].Arn" --output text 2>/dev/null || true)

if [ -n "$EXISTING_PROVIDER" ]; then
  echo "✅ OIDC Provider already exists: $PROVIDER_ARN"
else
  echo "🚀 Creating OIDC Provider for GitHub Actions ($OIDC_URL)..."
  aws iam create-open-id-connect-provider \
    --url "$OIDC_URL" \
    --client-id-list "$AUDIENCE" \
    --thumbprint-list "${THUMBPRINTS[@]}" \
    --output json >/dev/null
  echo "✅ Successfully created OIDC Provider: $PROVIDER_ARN"
fi

# 3. Create or Update IAM Role for GitHub Actions
echo ""
echo "🛡️  Configuring IAM Role: $ROLE_NAME..."

TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "${PROVIDER_ARN}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_REPO}:*"
        },
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "${AUDIENCE}"
        }
      }
    }
  ]
}
EOF
)

ROLE_EXISTS=$(aws iam get-role --role-name "$ROLE_NAME" --query "Role.Arn" --output text 2>/dev/null || true)

if [ -n "$ROLE_EXISTS" ]; then
  echo "🔄 Role exists. Updating assume-role trust policy..."
  aws iam update-assume-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-document "$TRUST_POLICY"
  ROLE_ARN="$ROLE_EXISTS"
  echo "✅ Trust policy updated for role: $ROLE_ARN"
else
  echo "🚀 Creating IAM Role '$ROLE_NAME'..."
  ROLE_ARN=$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --description "Keyless OIDC deployment role for GitHub Actions in $GITHUB_REPO" \
    --query "Role.Arn" \
    --output text)
  echo "✅ Created IAM Role: $ROLE_ARN"
fi

# 4. Attach Deployment Policy to the Role
echo ""
echo "🔗 Attaching AdministratorAccess policy to $ROLE_NAME..."
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn "arn:aws:iam::aws:policy/AdministratorAccess"
echo "✅ AdministratorAccess attached."

# 5. Set AWS_ROLE_ARN in GitHub Repository Variables
echo ""
echo "⚙️  Setting AWS_ROLE_ARN repository variable in GitHub..."
gh variable set AWS_ROLE_ARN -b "$ROLE_ARN"
echo "✅ GitHub Repository Variable 'AWS_ROLE_ARN' set to: $ROLE_ARN"

# Also set environment variables for dev and prod if they exist
for ENV in dev prod; do
  if gh api "repos/${GITHUB_REPO}/environments/${ENV}" >/dev/null 2>&1; then
    gh variable set AWS_ROLE_ARN -b "$ROLE_ARN" --env "$ENV" 2>/dev/null || true
    echo "✅ GitHub Environment Variable 'AWS_ROLE_ARN' set for '$ENV'"
  fi
done

echo ""
echo "=================================================================="
echo "🎉 SUCCESS: GitHub Actions OIDC is now fully configured!"
echo "=================================================================="
echo "IAM Role ARN: $ROLE_ARN"
echo ""
echo "Next steps:"
echo "1. GitHub Actions will now automatically assume this role via OIDC."
echo "2. Once verified, you can safely remove static AWS credentials:"
echo "   gh secret delete AWS_ACCESS_KEY_ID 2>/dev/null || true"
echo "   gh secret delete AWS_SECRET_ACCESS_KEY 2>/dev/null || true"
echo "   gh secret delete AWS_ACCESS_KEY_ID --env dev 2>/dev/null || true"
echo "   gh secret delete AWS_SECRET_ACCESS_KEY --env dev 2>/dev/null || true"
echo "   gh secret delete AWS_ACCESS_KEY_ID --env prod 2>/dev/null || true"
echo "   gh secret delete AWS_SECRET_ACCESS_KEY --env prod 2>/dev/null || true"
echo "=================================================================="
