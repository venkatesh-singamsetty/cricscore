---
name: cricscore-code-review-standards
description: Use when reviewing a CricScore pull request, branch diff, or code change for correctness, regressions, security, data integrity, or missing tests.
---

# CricScore Code Review Standards

Review the complete diff against `origin/main` (`git diff origin/main`) and trace every changed behavior across its callers, backend consumers, database persistence, WebSocket broadcasts, and E2E tests.

## 1. Domain-Specific Review Checklist

1. **Live Score & Cricket Domain Integrity**:
   - **Strike Rotation & Batter Attribution**: Verify that WebSocket consumers (`LiveScoreboard.tsx`) attribute runs and balls faced to `ballData.batterName` (the batter who faced the delivery), NOT `strikerName` (which already reflects post-delivery strike rotation on odd runs or over completion).
   - **Cumulative Totals & Undo**: Ensure `score-update`, `storage-worker`, `applyLiveScoreToMatches.ts`, and `LiveScoreboard.tsx` pass and apply authoritative `explicitTotalRuns` and `explicitTotalWickets` on both normal deliveries and `undo: true` events.
   - **Idempotent Innings & Match Completion**: Verify 2nd-innings creation uses `ON CONFLICT (match_id, inning_number) DO UPDATE` and client-generated `inn2_<timestamp>` IDs are resolved to canonical database `inning_id` values in `storage-worker` and `match-api`.
   - **Format-Agnostic Overs (1–20 Overs)**: Never hardcode `20` overs or `120` balls in DLS (`dlsUtils.ts`) or ML win probability (`AiMatchPrediction.tsx`, `predict.py`, `win_probability.py`); always derive `totalBalls = totalOvers * 6`.
2. **CodeQL & Static Analysis Cleanliness**:
   - Check for unused variables, unused imports, unreachable branches, and unawaited async state updates in tests (`act(...)` warnings).
3. **Playwright E2E Selector Compatibility**:
   - Whenever button labels, headings, placeholders, or default values change in `MatchSetup.tsx`, `MatchView.tsx`, or `App.tsx`, verify that `apps/e2e/tests/user-journey.spec.ts` and `smoke.spec.ts` selectors still match so CI never times out.
4. **Security, Cost & Infrastructure**:
   - Check for SQL injection (require parameterized `$1, $2` queries), missing Cognito/admin authorization checks, connection pool leaks (`new Pool()` inside handler), or forbidden paid AWS resources.
5. **Tests & Documentation**:
   - Verify unit/component/ML tests and documentation (`docs/changelog.md`, `docs/testing.md`, tutorials) are updated alongside code changes.

## 2. Reporting Findings

- Order actionable findings by severity: **Critical**, **High**, **Medium**, **Low**.
- For each finding, cite the exact file path and line range, explain the concrete failure scenario, and provide a targeted fix.
- Explicitly note any validation gaps (e.g., skipped E2E or missing edge-case test).
