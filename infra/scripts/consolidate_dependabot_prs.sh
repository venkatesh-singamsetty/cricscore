#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# CricScore Dependabot PR Consolidator (Collaborator-Guarded)
# ------------------------------------------------------------------------------
# Safely pulls open PRs authored strictly by Dependabot (app/dependabot) into
# the current working branch, and closes them ONLY after verifying:
#   1. The authenticated GitHub user has admin/maintain/write collaborator access
#      on venkatesh-singamsetty/cricscore.
#   2. The current working branch has been pushed to canonical origin.
# ==============================================================================

REPO="venkatesh-singamsetty/cricscore"
MODE="merge"
TARGET_PR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --merge)
      MODE="merge"
      shift
      ;;
    --close)
      MODE="close"
      shift
      ;;
    --target-pr)
      TARGET_PR="$2"
      shift 2
      ;;
    *)
      echo "Usage: $0 [--merge] [--close --target-pr <PR_NUMBER>]"
      exit 1
      ;;
  esac
done

# 1. Verify canonical remote
ORIGIN_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [[ "$ORIGIN_URL" != *"venkatesh-singamsetty/cricscore"* && "$ORIGIN_URL" != *"venkatesh-singamsetty/cric-score"* ]]; then
  echo "❌ Security Gate Failed: 'origin' ($ORIGIN_URL) is not the canonical repository ($REPO)."
  exit 1
fi

# 2. Verify GitHub Collaborator Permission (admin | maintain | write)
LOGIN=$(gh api user --jq .login 2>/dev/null || echo "")
if [[ -z "$LOGIN" ]]; then
  echo "❌ Security Gate Failed: Not authenticated with GitHub CLI (gh)."
  exit 1
fi

PERM=$(gh api "repos/$REPO/collaborators/$LOGIN/permission" --jq .permission 2>/dev/null || echo "none")
if [[ "$PERM" != "admin" && "$PERM" != "maintain" && "$PERM" != "write" ]]; then
  echo "❌ Security Gate Failed: User '@$LOGIN' has permission '$PERM' on $REPO."
  echo "   Only collaborators (admin/maintain/write) may consolidate or close Dependabot PRs."
  exit 1
fi

echo "✅ Collaborator verified: @$LOGIN (permission: $PERM)"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" == "main" || "$CURRENT_BRANCH" == "HEAD" ]]; then
  echo "❌ Please run on a feature/fix working branch, not '$CURRENT_BRANCH'."
  exit 1
fi

# 3. Query strictly open Dependabot PRs (author.login == "app/dependabot" and is_bot == true)
PRS_JSON=$(gh pr list --repo "$REPO" --author "app/dependabot" --state open --json number,title,headRefName,headRefOid,author \
  --jq '[.[] | select(.author.login == "app/dependabot" and .author.is_bot == true)] | sort_by(.number)')

PR_COUNT=$(echo "$PRS_JSON" | jq 'length')
if [[ "$PR_COUNT" -eq 0 ]]; then
  echo "ℹ️  No open Dependabot PRs found on $REPO."
  exit 0
fi

echo "📦 Found $PR_COUNT open Dependabot PR(s):"
echo "$PRS_JSON" | jq -r '.[] | "   - #\(.number): \(.title) (\(.headRefName))"'

if [[ "$MODE" == "merge" ]]; then
  for NUM in $(echo "$PRS_JSON" | jq -r '.[].number'); do
    echo "🔄 Fetching and merging Dependabot PR #$NUM into $CURRENT_BRANCH..."
    git fetch origin "pull/$NUM/head:dependabot-$NUM"
    git merge --no-edit "dependabot-$NUM"
    git branch -D "dependabot-$NUM"
  done
  echo "✅ All $PR_COUNT Dependabot PR(s) merged into $CURRENT_BRANCH."
  echo "👉 Next: run './infra/scripts/validate_local.sh --skip-e2e', push '$CURRENT_BRANCH' to origin, then run '$0 --close --target-pr <PR_NUM>'."
elif [[ "$MODE" == "close" ]]; then
  # Verify current branch exists on origin and is pushed
  REMOTE_HEAD=$(git ls-remote --heads origin "$CURRENT_BRANCH" | awk '{print $1}')
  if [[ -z "$REMOTE_HEAD" ]]; then
    echo "❌ Safety Gate: Branch '$CURRENT_BRANCH' is not pushed to origin yet. Push before closing Dependabot PRs."
    exit 1
  fi

  git fetch origin "$CURRENT_BRANCH" >/dev/null 2>&1 || true

  while IFS= read -r ROW; do
    [[ -z "$ROW" ]] && continue
    NUM=$(echo "$ROW" | jq -r '.number')
    SHA=$(echo "$ROW" | jq -r '.headRefOid')
    git fetch origin "pull/$NUM/head" >/dev/null 2>&1 || true
    if ! git merge-base --is-ancestor "$SHA" "origin/$CURRENT_BRANCH" 2>/dev/null; then
      echo "❌ Safety Gate: Dependabot PR #$NUM ($SHA) is NOT an ancestor of origin/$CURRENT_BRANCH. Aborting close!"
      exit 1
    fi
  done < <(echo "$PRS_JSON" | jq -c '.[]')

  COMMENT_REF="branch \`$CURRENT_BRANCH\`"
  if [[ -n "$TARGET_PR" ]]; then
    COMMENT_REF="PR #$TARGET_PR (\`$CURRENT_BRANCH\`)"
  fi

  for NUM in $(echo "$PRS_JSON" | jq -r '.[].number'); do
    echo "🔒 Closing superseded Dependabot PR #$NUM (verified in origin/$CURRENT_BRANCH)..."
    gh pr close "$NUM" --repo "$REPO" --delete-branch \
      --comment "Consolidated, validated, and merged into $COMMENT_REF by verified collaborator @$LOGIN."
  done
  echo "✅ Closed $PR_COUNT superseded Dependabot PR(s) safely."
fi
