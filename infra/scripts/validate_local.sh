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
echo "🛠️ 2. Backend Validation..."
echo "-----------------------------------"
(
  cd apps/backend
  echo "👉 Running Backend Unit Tests..."
  npm test
)

echo ""
echo "-----------------------------------"
echo "🛠️ 3. Infrastructure Validation..."
echo "-----------------------------------"
echo "👉 Checking Terraform Formatting..."
./infra/scripts/terraform.sh fmt -check -recursive

echo "👉 Validating Terraform Logic..."
./infra/scripts/terraform.sh validate

echo ""
echo "-----------------------------------"
echo "🌐 4. End-to-End Testing (Playwright)..."
echo "-----------------------------------"
(
  cd apps/e2e
  if [ ! -d "node_modules" ]; then
    echo "👉 Installing E2E dependencies..."
    npm install
    npx playwright install chromium
  fi
  echo "👉 Running Playwright Tests against live environment..."
  npx playwright test
)

echo ""
echo "-----------------------------------"
echo "🔒 5. Security & Dependency Scans..."
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

if command -v trivy &> /dev/null; then
  echo "👉 Running Trivy Vulnerability Scan..."
  trivy fs ./apps/frontend --scanners vuln --severity HIGH,CRITICAL --quiet
  trivy fs ./apps/backend/lambdas --scanners vuln --severity HIGH,CRITICAL --quiet
else
  echo "⚠️ trivy not installed, skipping. Run ./infra/scripts/setup.sh"
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
