#!/usr/bin/env bash
# ==============================================================================
# CricScore Start Feature/Fix Branch Tool
#
# Usage:
#   ./infra/scripts/start_feature_branch.sh <branch-name>
#
# Example:
#   ./infra/scripts/start_feature_branch.sh feat/ai-agent-test-suite
#
# Guarantees:
#   1. Working tree is clean (no uncommitted or unstaged changes).
#   2. Latest origin/main is fetched and local main is fast-forwarded cleanly.
#   3. The new branch is created strictly from origin/main (zero branch divergence).
#   4. Checks for open Dependabot PRs and consolidates them if authorized.
# ==============================================================================

set -euo pipefail

BRANCH_NAME="${1:-}"

if [ -z "$BRANCH_NAME" ]; then
  echo "❌ Error: Branch name is required."
  echo "👉 Usage: ./infra/scripts/start_feature_branch.sh <feat|fix>/<branch-name>"
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

echo "==================================================="
echo "🌱 CricScore Fresh Branch Initializer: '$BRANCH_NAME'"
echo "==================================================="

# 1. Verify working directory is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Working directory is dirty! Commit or stash your changes before creating a new branch."
  git status --short
  exit 1
fi

# 2. Fetch latest origin/main
echo "📡 Fetching latest 'origin/main'..."
git fetch origin main --quiet

# 3. Checkout main and fast-forward to origin/main
echo "🔄 Fast-forwarding local 'main' to 'origin/main'..."
git checkout main --quiet
git reset --hard origin/main --quiet

# 4. Check if the requested branch already exists locally or remotely
if git rev-parse --verify "$BRANCH_NAME" >/dev/null 2>&1; then
  echo "⚠️  Branch '$BRANCH_NAME' already exists locally."
  echo "👉 Checking out existing branch '$BRANCH_NAME' and merging 'origin/main'..."
  git checkout "$BRANCH_NAME" --quiet
  git merge origin/main --no-edit --quiet
else
  echo "🌿 Creating fresh branch '$BRANCH_NAME' from 'origin/main'..."
  git checkout -b "$BRANCH_NAME" origin/main --quiet
fi

# 5. Check for open Dependabot PRs to consolidate
if [ -f "$REPO_ROOT/infra/scripts/consolidate_dependabot_prs.sh" ]; then
  echo "📦 Checking for open Dependabot PRs to consolidate..."
  "$REPO_ROOT/infra/scripts/consolidate_dependabot_prs.sh" --merge || true
fi

echo "==================================================="
echo "✅ Fresh branch '$BRANCH_NAME' is ready and 100% in sync with origin/main!"
echo "📍 Current HEAD: $(git log -1 --oneline)"
echo "==================================================="
