---
name: cricscore-frontend-architecture
description: Use when changing CricScore React UI, live scoreboard state, match setup, authentication, responsive layouts, or browser-specific behavior.
---

# CricScore Frontend Architecture

Read the target component and its parent/child callers before modifying props or state. Preserve role-based access (`scorerAccess.ts`) across Scorer, Spectator (`LiveScoreboard`), and Admin (`AdminPanel`) views.

## 1. Live Score Synchronization & State Reconciliation

- **Authoritative Cumulative Totals (`explicitTotalRuns` / `explicitTotalWickets`)**:
  - `MatchView.tsx` includes `explicitTotalRuns`, `explicitTotalWickets`, `overs`, and `balls` in every `POST /match/{id}/score` payload (both normal deliveries and `undo: true`).
  - `applyLiveScoreToMatches.ts` and `LiveScoreboard.tsx` must use `explicitTotalRuns` and `explicitTotalWickets` when present rather than blindly adding incremental runs, preventing drift or double-counting.
- **Monotonic Score Reconciliation & Inning Continuity**:
  - `LiveScoreboard.tsx` enforces monotonic state reduction: background REST polling must NEVER downgrade or zero-out live scores (`Math.max(old.totalRuns, inn.totalRuns)` and `Math.max(old.totalWickets, inn.totalWickets)`).
  - Preserves active batters, bowlers, and `allBalls` history across REST polling intervals. If a background poll returns a lagging DB response or empty arrays, the active live WebSocket state takes precedence.
  - Multi-Inning Preservation: When transitioning to Inning 2 or match completion, prior completed innings in `prev.innings` are retained so completed 1st innings scorecards never vanish from spectator view.
- **Strike-Rotation Batter Attribution (`ballData.batterName`)**:
  - When an odd run (1, 3) or over end rotates strike, `strikerName` in the WebSocket payload represents the _next_ ball's striker, while `ballData.batterName` identifies the batter who actually faced the delivery.
  - `LiveScoreboard.tsx` must attribute runs, boundaries, and balls faced strictly to `ballData.batterName` before updating crease positions (`strikerName` / `nonStrikerName`) so individual batter scores always sum to the team total.
- **WebSocket vs. Polling Recency Guard (`lastWsUpdateRef`)**:
  - `LiveScoreboard.tsx` records `lastWsUpdateRef.current = Date.now()` on every WebSocket message and suppresses background REST polling overwrites for 3 seconds (unless an innings transition occurred) so a slightly lagging DB read never reverts a live boundary or wicket.

## 2. Scorer Cockpit (`MatchView.tsx`), Mobile Sign-In (`Authenticator`) & Innings Lifecycle

- **Zero-Scroll Viewport (`100dvh`) for Scorer, Sign-In & Chat (`VIEWER` Scrolls)**:
  - `SCORER` (both unauthenticated Cognito `<Authenticator>` Sign-In and live `MatchView.tsx`) and `CHAT` (`ChatComponent.tsx`) must fit 100% inside the remaining `flex-1 min-h-0` viewport below the global header without wasted top padding (`p-0` on mobile) or page-level vertical scrolling.
  - Keep `[data-amplify-theme]` and mobile `[data-amplify-authenticator]` bounded to `height: 100%` (`flex: 1 1 0%; min-height: 0`) with a compact inline `.auth-hero` (`🏏 CRICSCORE` on a single row) and `white-space: nowrap` tabs so both Sign-In and Create Account fit cleanly on mobile screens.
  - `VIEWER` (`LiveScoreboard.tsx` / `MatchList.tsx`) intentionally uses `overflow-y-auto` so spectators can scroll through live feeds and historical match records.
  - Keep the scoreboard header, centered Target Pill (`🎯 X OFF Y` directly beneath `Scorecard 📋`), AI Win Probability bar, DLS Par pill, Batter/Bowler cards, `This Over` strip, Action Tabs (`Undo`, `Change Bowler`, `Change Batter`, `Retire`), Extras row, and Run Keypad fitting cleanly inside the viewport on both mobile and desktop (`min-h-0`, balanced padding).
- **Auto-End 1st Innings & Refresh-Safe Undo**:
  - Automatically trigger `onInningsEnd` on the final legal delivery of the 1st innings (`newOvers >= totalOvers`).
  - In `App.tsx`, the Innings Break modal provides `← Back to 1st Innings`, returning to `MatchView` where `isInningsComplete` renders prominent inline **Undo Last Ball** and highlighted **Proceed to 2nd Innings ➔** buttons.
  - `canUndo` and `handleUndo` must support reconstructing the pre-delivery state from `innings.allBalls` when in-memory `history` is empty (e.g., after a browser refresh).

## 3. Format-Agnostic DLS (`dlsUtils.ts`) & AI Win Probability (`AiMatchPrediction.tsx`)

- **Any-Overs Support (1–20 Overs)**:
  - `calculateDlsParScore(firstInningsTotal, secondInningsRuns, wicketsLost, ballsBowled, maxOvers)` uses a format-normalized exponential resource decay curve scaled by `maxOvers`. Never hardcode 20 overs.
  - `AiMatchPrediction.tsx` computes `totalBalls = totalOvers * 6`, `ballsLeft = Math.max(0, totalBalls - ballsBowled)`, shows a `50% - 50%` baseline before the first ball, and immediately overrides impossible chases (`runsNeeded > ballsLeft * 6` or `wicketsLost >= 10`) to `0% - 100%` without waiting on a network round-trip.

## 4. Verification & E2E Compatibility

- Run `npm --prefix apps/frontend run lint && npm --prefix apps/frontend test -- --run` and ensure zero unused variables (CodeQL clean) and zero React `act(...)` warnings.
- If any button text, heading, or default team name in `MatchSetup.tsx`, `MatchView.tsx`, or `App.tsx` changes, update `apps/e2e/tests/user-journey.spec.ts` in the same commit.
