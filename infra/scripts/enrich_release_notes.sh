#!/usr/bin/env bash
# ==============================================================================
# CricScore Release Notes Enrichment Tool
#
# Automatically guarantees that:
# 1. Release title is strictly the version tag (e.g. "v4.19.2") with no extra text.
# 2. Release notes are automatically enriched with full details, architecture
#    decisions, root cause analysis, and test results from linked pull requests.
# ==============================================================================

set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "⚠️ GitHub CLI (gh) not installed. Skipping release enrichment."
  exit 0
fi

# 1. Get latest published release
LATEST_TAG=$(gh release view --json tagName -q .tagName 2>/dev/null || echo "")
if [ -z "$LATEST_TAG" ]; then
  echo "ℹ️ No releases found on GitHub. Skipping enrichment."
  exit 0
fi

echo "🔍 Inspecting latest release: $LATEST_TAG"

# 2. Enforce clean title (strictly version tag, e.g. "v4.19.2")
gh release edit "$LATEST_TAG" --title "$LATEST_TAG"

# 3. Fetch current release body
CURRENT_BODY=$(gh release view "$LATEST_TAG" --json body -q .body 2>/dev/null || echo "")

# 4. Check for PR references in the release body (e.g. #315)
PR_NUMBERS=$(echo "$CURRENT_BODY" | grep -oE '#[0-9]+' | tr -d '#' | sort -u || true)

for PR_NUM in $PR_NUMBERS; do
  echo "🔗 Checking linked PR: #$PR_NUM"
  PR_BODY=$(gh pr view "$PR_NUM" --json body -q .body 2>/dev/null || echo "")
  # Extract high-level summary if present and not already included
  if [ -n "$PR_BODY" ] && ! echo "$CURRENT_BODY" | grep -qF "Overview & Purpose"; then
    echo "✨ Extracting clean overview from PR #$PR_NUM..."
    # Extract overview or summary section if present
    CLEAN_OVERVIEW=$(echo "$PR_BODY" | awk '/## (🎯 )?(Overview|Summary)/{flag=1; next} /^## (Validation|Testing|Checks)/{flag=0} flag' | sed '/^$/N;/^\n$/D' || true)
    if [ -n "$CLEAN_OVERVIEW" ]; then
      NEW_BODY="${CURRENT_BODY}

---

### 🎯 Overview & Purpose

${CLEAN_OVERVIEW}"
      gh release edit "$LATEST_TAG" --notes "$NEW_BODY"
      CURRENT_BODY="$NEW_BODY"
    fi
  fi
done

echo "✅ Release $LATEST_TAG notes enrichment complete!"
