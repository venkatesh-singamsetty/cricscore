#!/bin/bash
# CricScore - Proactive Dependency & Dependabot Check
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

echo "🔍 ==================================================="
echo "📦 CricScore Proactive Dependency & Dependabot Audit"
echo "==================================================="
echo ""

# ----------------------------------------------------
# 1. Check for Open Dependabot PRs
# ----------------------------------------------------
echo "👉 1. Checking for open Dependabot PRs..."
if command -v gh >/dev/null 2>&1; then
  BOT_PRS=$(gh pr list --author "app/dependabot" --state open --json number,title,url --jq '.[] | "  • #\(.number): \(.title) (\(.url))"' 2>/dev/null || true)
  if [ -n "$BOT_PRS" ]; then
    echo "⚠️  Found open Dependabot PRs:"
    echo "$BOT_PRS"
    echo ""
    echo "💡 Action: Run './infra/scripts/consolidate_dependabot_prs.sh --merge' to pull, test, and consolidate them into your branch before pushing!"
  else
    echo "✅ No open Dependabot PRs found on GitHub."
  fi
else
  echo "⚠️  gh CLI not installed or not in PATH, skipping GitHub PR check."
fi

echo ""

# ----------------------------------------------------
# 2. Check for Outdated NPM Packages (Frontend & Root)
# ----------------------------------------------------
echo "👉 2. Checking for outdated NPM packages in Root & Frontend..."
OUTDATED_ROOT=$(npm outdated 2>/dev/null || true)
if [ -n "$OUTDATED_ROOT" ]; then
  echo "$OUTDATED_ROOT"
else
  echo "✅ All Root and Frontend NPM packages are up-to-date."
fi

echo ""

# ----------------------------------------------------
# 3. Check for Outdated NPM Packages in Backend Lambdas
# ----------------------------------------------------
echo "👉 3. Checking for outdated NPM packages in Backend Lambdas..."
LAMBDA_OUTDATED=0
for d in apps/backend/lambdas/*; do
  if [ -f "$d/package.json" ]; then
    NAME=$(basename "$d")
    OUT=$( (cd "$d" && npm outdated 2>/dev/null) || true )
    if [ -n "$OUT" ]; then
      echo "📦 Lambda: $NAME"
      echo "$OUT"
      echo ""
      LAMBDA_OUTDATED=$((LAMBDA_OUTDATED + 1))
    fi
  fi
done

if [ "$LAMBDA_OUTDATED" -eq 0 ]; then
  echo "✅ All Backend Lambda NPM packages are up-to-date."
fi

echo ""

# ----------------------------------------------------
# 4. Check for Outdated Python ML Engine Dependencies
# ----------------------------------------------------
if [ -f "apps/ml-engine/venv/bin/pip" ]; then
  echo "👉 4. Checking Python ML Engine dependencies..."
  PY_OUTDATED=$(apps/ml-engine/venv/bin/pip list --outdated 2>/dev/null || true)
  if [ -n "$PY_OUTDATED" ]; then
    echo "$PY_OUTDATED"
  else
    echo "✅ Python ML Engine packages are up-to-date."
  fi
  echo ""
fi

echo "==================================================="
echo "🏁 Dependency check complete."
echo "==================================================="
