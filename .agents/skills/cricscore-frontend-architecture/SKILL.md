---
name: cricscore-frontend-architecture
description: Use when changing CricScore React UI, live scoreboard state, match setup, authentication, responsive layouts, or browser-specific behavior.
---

# CricScore Frontend Architecture

Read the affected component and its callers before changing prop or state flow. Keep scorer, viewer, and admin behavior consistent with their existing access rules.

## Live score and match state

- Live components should use current innings and match state passed by their parents; do not let default props mask missing data flow.
- Cricket overs notation is `completed overs.balls completed` (for example, `5.1` means 5 overs and 1 legal ball; `6.0` means 6 completed overs). Extras and retirement events must follow scoring-domain rules, not presentation assumptions.
- Show a final match result only when the match is completed. Keep score, innings, target, and prediction state aligned after events and undo.

## Responsive and browser behavior

- Preserve mobile and laptop/desktop layouts when changing shared components. Prefer responsive utility classes and validate the actual affected viewport sizes.
- For full-screen mobile and keyboard-sensitive views, account for dynamic viewport sizing and ensure flex children can shrink (`min-h-0`) and intended regions can scroll. Avoid fixed-height assumptions that hide controls.
- Keep keyboard, autofill, focus, and scroll workarounds evidence-based and scoped to the affected browser; do not add global viewport listeners or input hacks without a demonstrated need.

Add or update component tests for state, access, and responsive behavior where the test setup supports it. Run `(cd apps/frontend && npm run lint && npm test)` for frontend changes.
