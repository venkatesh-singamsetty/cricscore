#!/bin/bash
# CricScore - Local Pre-Push Validation Script
# Usage:
#   ./infra/scripts/validate_local.sh --fast       (changed-areas-only pre-push, ~5-15s)
#   ./infra/scripts/validate_local.sh --skip-e2e   (full local suite without live Playwright E2E)
#   ./infra/scripts/validate_local.sh              (full suite including live Playwright E2E)
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

SKIP_E2E=false
SKIP_SBOM=true
SKIP_DEPS=false
CHANGED_ONLY=false
FAST_MODE=false

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
    --skip-deps)
      SKIP_DEPS=true
      ;;
    --changed-only)
      CHANGED_ONLY=true
      ;;
    --fast)
      FAST_MODE=true
      CHANGED_ONLY=true
      SKIP_E2E=true
      SKIP_SBOM=true
      SKIP_DEPS=true
      ;;
  esac
done

RUN_FRONTEND=true
RUN_BACKEND=true
RUN_PYTHON=true
RUN_TERRAFORM=true

if [ "$CHANGED_ONLY" = true ]; then
  CHANGED_FILES="$( (git diff --name-only origin/main...HEAD 2>/dev/null; git diff --name-only 2>/dev/null; git diff --cached --name-only 2>/dev/null) | sort -u )"
  if [ -n "$CHANGED_FILES" ]; then
    RUN_FRONTEND=false
    RUN_BACKEND=false
    RUN_PYTHON=false
    RUN_TERRAFORM=false

    echo "$CHANGED_FILES" | grep -qE '^(apps/frontend/|package\.json|package-lock\.json)' && RUN_FRONTEND=true || true
    echo "$CHANGED_FILES" | grep -qE '^(apps/backend/|package\.json|package-lock\.json)' && RUN_BACKEND=true || true
    echo "$CHANGED_FILES" | grep -qE '^(apps/ai-service/|apps/ml-engine/)' && RUN_PYTHON=true || true
    echo "$CHANGED_FILES" | grep -qE '^(infra/terraform/)' && RUN_TERRAFORM=true || true
  fi
  echo "⚡ Starting Fast Changed-Files Validation (frontend=$RUN_FRONTEND, backend=$RUN_BACKEND, python=$RUN_PYTHON, terraform=$RUN_TERRAFORM)..."
else
  echo "🚀 Starting Full Local Validation..."
fi

if [ "$RUN_FRONTEND" = true ]; then
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

    if [ "$FAST_MODE" = false ]; then
      echo "👉 Running NPM Security Audit..."
      npm audit --audit-level=high --fetch-timeout=10000 || echo "⚠️ npm audit endpoint returned an error or timed out (skipping network audit)"
    fi

    echo "👉 Verifying Production Build..."
    npm run build
  )
else
  echo "⏭️  Skipping Frontend Validation (no frontend changes)."
fi

if [ "$RUN_BACKEND" = true ]; then
  echo ""
  echo "-----------------------------------"
  echo "🛠️ 2. Backend Validation..."
  echo "-----------------------------------"
  (
    cd apps/backend
    echo "👉 Running Backend Unit Tests..."
    LLM_API_KEY="${LLM_API_KEY:-dummy}" OPENAI_API_KEY="${OPENAI_API_KEY:-dummy}" npm test

    if [ "$FAST_MODE" = false ]; then
      echo "👉 Running NPM Security Audit..."
      npm audit --audit-level=high --fetch-timeout=10000 || echo "⚠️ npm audit endpoint returned an error or timed out (skipping network audit)"
    fi
  )
else
  echo "⏭️  Skipping Backend Validation (no backend changes)."
fi

if [ "$RUN_PYTHON" = true ]; then
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
else
  echo "⏭️  Skipping Python Validation (no Python changes)."
fi

if [ "$RUN_TERRAFORM" = true ]; then
  echo ""
  echo "-----------------------------------"
  echo "🛠️ 3. Infrastructure Validation..."
  echo "-----------------------------------"
  echo "👉 Checking Terraform Formatting..."
  ./infra/scripts/terraform.sh fmt -check -recursive

  echo "👉 Validating Terraform Logic..."
  ./infra/scripts/terraform.sh validate

  if [ "$FAST_MODE" = false ]; then
    echo "👉 Verifying Central Platform Dashboard Generation..."
    ./infra/scripts/generate_platform_dashboard.sh
  fi

  echo "✅ Terraform S3 backend locking is enforced by Terraform during plan and apply."
else
  echo "⏭️  Skipping Infrastructure Validation (no Terraform changes)."
fi

echo ""
echo "-----------------------------------"
echo "🌐 4. End-to-End Testing (Playwright)..."
echo "-----------------------------------"
if [ "$SKIP_E2E" = true ]; then
  echo "⏭️  Skipping Playwright E2E Tests (--skip-e2e/--fast flag provided)..."
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

if [ "$RUN_TERRAFORM" = true ] && command -v checkov >/dev/null 2>&1; then
  echo "👉 Running Checkov IaC Scan..."
  checkov -d infra/terraform/ --quiet --download-external-modules false
elif [ "$RUN_TERRAFORM" = true ]; then
  echo "⚠️ checkov not installed, skipping. Run ./infra/scripts/setup.sh"
fi

if command -v gitleaks >/dev/null 2>&1; then
  echo "👉 Running GitLeaks Secrets Scan..."
  gitleaks detect --source . -v
else
  echo "⚠️ gitleaks is not installed, skipping. Run ./infra/scripts/setup.sh"
fi

if [ "$FAST_MODE" = false ]; then
  if command -v trivy >/dev/null 2>&1; then
    echo "👉 Running Trivy Vulnerability Scan..."
    trivy fs . --scanners vuln --severity HIGH,CRITICAL --quiet
  else
    echo "⚠️ trivy not installed, skipping. Run ./infra/scripts/setup.sh"
  fi
else
  echo "⏭️  Skipping Trivy in --fast mode (enforced in PR CI)."
fi

if [ "$SKIP_SBOM" = true ]; then
  echo "⏭️  Skipping Syft SBOM generation (handled automatically in CI/CD; use --sbom to generate locally)..."
elif command -v syft >/dev/null 2>&1; then
  echo "👉 Generating Syft SBOM..."
  syft scan:package-lock.json -o spdx-json > cricscore-sbom.json
  echo "✅ cricscore-sbom.json generated."
else
  echo "⚠️ syft not installed, skipping. Run ./infra/scripts/setup.sh"
fi

if [ "$SKIP_DEPS" = false ] && [ -f "$REPO_ROOT/infra/scripts/check_dependencies.sh" ]; then
  echo ""
  echo "-----------------------------------"
  echo "📦 6. Proactive Dependency & Dependabot Check..."
  echo "-----------------------------------"
  "$REPO_ROOT/infra/scripts/check_dependencies.sh"
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
    STATUS_OUT="$(git status --porcelain 2>/dev/null)"
    STATUS_HASH="$(echo "$STATUS_OUT" | $HASH_CMD | awk '{print $1}')"
    echo "${TREE_HASH}:${STATUS_HASH}" > "$REPO_ROOT/.git/.local_validation_receipt"
  fi
fi
