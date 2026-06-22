#!/bin/bash
# CricScore - Local Pre-Push Validation Script
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "🚀 Starting Full Local Validation..."

echo ""
echo "-----------------------------------"
echo "🛠️ 1. Frontend Validation..."
echo "-----------------------------------"
(
  cd apps/frontend
  echo "👉 Running Lint..."
  npm run lint
  
  echo "👉 Running Unit Tests..."
  npm run test
  
  echo "👉 Verifying Production Build..."
  npm run build
)

echo ""
echo "-----------------------------------"
echo "🛠️ 2. Infrastructure Validation..."
echo "-----------------------------------"
echo "👉 Checking Terraform Formatting..."
./infra/scripts/terraform.sh fmt -check -recursive

echo "👉 Validating Terraform Logic..."
./infra/scripts/terraform.sh validate

echo ""
echo "-----------------------------------"
echo "🔒 3. Security & Dependency Scans..."
echo "-----------------------------------"

if command -v checkov &> /dev/null; then
  echo "👉 Running Checkov IaC Scan..."
  checkov -d infra/terraform/ --quiet
else
  echo "⚠️ checkov not installed, skipping. Run ./infra/scripts/setup.sh"
fi

if command -v gitleaks &> /dev/null; then
  echo "👉 Running GitLeaks Secrets Scan..."
  gitleaks detect --source . -v
else
  echo "⚠️ gitleaks not installed, skipping. Run ./infra/scripts/setup.sh"
fi

if command -v syft &> /dev/null; then
  echo "👉 Generating Syft SBOM..."
  syft dir:. -o spdx-json > cricscore-sbom.json
  echo "✅ cricscore-sbom.json generated."
else
  echo "⚠️ syft not installed, skipping. Run ./infra/scripts/setup.sh"
fi

echo ""
echo "-----------------------------------"
echo "✅ All local validations passed! You are safe to push."
echo "-----------------------------------"
