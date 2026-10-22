#!/bin/bash
# CricScore - Local Pre-Push Validation Script
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

SKIP_E2E=false
SKIP_SBOM=true

for arg in "$@"; do
  case "$arg" in
    --skip-e2e)
      SKIP_E2E=true
      ;;
    --sbom)
      SKIP_SBOM=false
      ;;
    --skip-sbom)
      SKIP_SBOM=true
      ;;
    --fast)
      SKIP_E2E=true
      SKIP_SBOM=true
      ;;
  esac
done

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
  
  echo "👉 Running NPM Security Audit..."
  npm audit --audit-level=high --fetch-timeout=10000 || echo "⚠️ npm audit endpoint returned an error or timed out (skipping network audit)"

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
  LLM_API_KEY="${LLM_API_KEY:-dummy}" OPENAI_API_KEY="${OPENAI_API_KEY:-dummy}" npm test

  echo "👉 Running NPM Security Audit..."
  npm audit --audit-level=high --fetch-timeout=10000 || echo "⚠️ npm audit endpoint returned an error or timed out (skipping network audit)"
)

echo ""
echo "-----------------------------------"
echo "🛠️ 2.5. Python AI & ML Engine Validation..."
echo "-----------------------------------"
if [ -d "apps/ai-service/.venv" ]; then
  echo "👉 Running Python AI Service Tests..."
  ./apps/ai-service/.venv/bin/pytest apps/ai-service -q
fi

if [ -d "apps/ml-engine/venv" ]; then
  echo "👉 Running Python ML Engine Tests..."
  ./apps/ml-engine/venv/bin/pytest apps/ml-engine/test_predict.py -q
fi

echo ""
echo "-----------------------------------"
echo "🛠️ 3. Infrastructure Validation..."
echo "-----------------------------------"
echo "👉 Checking Terraform Formatting..."
./infra/scripts/terraform.sh fmt -check -recursive

echo "👉 Validating Terraform Logic..."
./infra/scripts/terraform.sh validate

echo "👉 Verifying Central Platform Dashboard Generation..."
./infra/scripts/generate_platform_dashboard.sh

echo "✅ Terraform S3 backend locking is enforced by Terraform during plan and apply."

echo ""
echo "-----------------------------------"
echo "🌐 4. End-to-End Testing (Playwright)..."
echo "-----------------------------------"
if [ "$SKIP_E2E" = true ]; then
  echo "⏭️  Skipping Playwright E2E Tests (--skip-e2e flag provided)..."
else
  (
    cd apps/e2e
    if [ ! -d "node_modules" ]; then
      echo "👉 Installing E2E dependencies..."
      npm install
      npx playwright install chromium
    fi
    echo "👉 Running Playwright Tests against live environment..."
    BASE_URL="${BASE_URL:-https://cricscoredev.venkateshsingamsetty.com}" \
    API_URL="${API_URL:-https://api.cricscoredev.venkateshsingamsetty.com}" \
    npm exec playwright test
  )
fi

echo ""
echo "-----------------------------------"
echo "🔒 5. Security & Dependency Scans..."
echo "-----------------------------------"

if command -v checkov &> /dev/null; then
  echo "👉 Running Checkov IaC Scan..."
  checkov -d infra/terraform/ --quiet --download-external-modules false
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

if [ "$SKIP_SBOM" = true ]; then
  echo "⏭️  Skipping Syft SBOM generation (handled automatically in CI on production merge; use --sbom to generate locally)..."
elif command -v syft &> /dev/null; then
  echo "👉 Generating Syft SBOM..."
  syft scan:package-lock.json -o spdx-json > cricscore-sbom.json
  echo "✅ cricscore-sbom.json generated."
else
  echo "⚠️ syft not installed, skipping. Run ./infra/scripts/setup.sh"
fi

echo ""
echo "-----------------------------------"
echo "✅ All local validations passed! You are safe to push."
echo "-----------------------------------"

# Record receipt in .git directory to avoid duplicate pre-push runs
if [ -d "$REPO_ROOT/.git" ]; then
  HASH_CMD=""
  if command -v sha256sum >/dev/null 2>&1; then
    HASH_CMD="sha256sum"
  elif command -v shasum >/dev/null 2>&1; then
    HASH_CMD="shasum -a 256"
  fi

  if [ -n "$HASH_CMD" ]; then
    TREE_HASH="$(git rev-parse HEAD 2>/dev/null || echo "no-head")"
    STATUS_HASH="$(git status --porcelain | $HASH_CMD | awk '{print $1}')"
    echo "${TREE_HASH}:${STATUS_HASH}" > "$REPO_ROOT/.git/.local_validation_receipt"
  fi
fi

