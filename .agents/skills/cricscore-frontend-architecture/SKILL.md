---
name: cricscore-frontend-architecture
description: Architectural specifications, styling patterns, and dynamic UI rules for the CricScore React frontend.
---

# CricScore Frontend Architecture Skill

## 1. Dynamic UI Components

- Ensure components that rely on live match data receive dynamic state updates (e.g. `currentScore`, `ballsLeft`, `targetScore`). Do not rely entirely on default prop values for live components.
- For nested views (like `LiveScoreboard` and `MatchView`), ensure state is passed correctly through all relevant children components.

## 2. Scoreboard & Overs Calculation Rules

- **Active Ball Score Display**: Active score in the Live Scoreboard must always be prefixed with the current batting team name (e.g., `TEAM A: 45/2 (5.3 ov)`).
- **Overs Notation**:
  - `5.1` = 5 overs completed, 1st ball of 6th over.
  - `5.5` = 5 overs completed, 5th ball of 6th over.
  - `6.0` = 6 completed overs.
- **Match Result State**: Scoreboard final match result (e.g. `Team A won by 10 runs`) must only render when `isCompleted` is `true`.

## 3. iOS Safari Layout & Keyboard Fixes

When implementing full-screen mobile chat or fixed-bottom layouts:

- Use `100dvh` (or `h-dvh` in Tailwind) instead of `100vh` or `fixed inset-0` to account for dynamic iOS Safari viewport resizing when the software keyboard opens.
- On scrollable containers (like chat logs), ensure proper Flexbox shrinking (`flex-1`, `min-h-0`) and add explicitly `-webkit-overflow-scrolling: touch`, `overscroll-behavior-y: contain`, and `touch-action: pan-y` to prevent scroll freezing.
- To prevent the iOS AutoFill / Input Accessory View toolbar from rendering and obscuring the input, add `autocomplete="off" autocorrect="off" spellcheck="false" name="chat-message-input"` to inputs.
- Bind `window.visualViewport` 'resize' events to dynamically pad the document body so inputs aren't obscured, and auto-scroll inputs into view via `onFocus` with a 300ms delay.
