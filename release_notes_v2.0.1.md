# CricScore v2.0.1 Release Notes

## 🏏 Cricket Laws & Scoring Accuracy Improvements
- **Strict No-Ball Dismissals:** A batter can now only be dismissed via `Caught` or `Run Out` off a No-Ball (Law 23/37/39). `Bowled`, `LBW`, `Hit Wicket`, and `Stumped` are no longer permitted options when a No-Ball is pending.
- **Strict Wide Dismissals:** A batter can now only be dismissed via `Run Out` off a Wide delivery (Law 25.6).
- **Correct Maiden Over Detection:** Overs containing a Wide or No-Ball are no longer mistakenly counted as Maiden overs, even if no runs were scored directly off the bat.
- **Retired Hurt Exemption:** `Retired Hurt` is no longer incorrectly tallied as a fallen wicket in the team's total wickets count.
- **Bowler Over Quotas Enforcement:** Bowlers are now strictly limited to a defined maximum quota (`Total Match Overs / 5`). The Bowling selection screen prominently displays `QUOTA FULL` and disables selection for capped bowlers.

## 👥 Custom Team Sizes & All-Out Logic
- **Dynamic Innings End:** The application now correctly identifies the conclusion of an innings for teams with fewer than 11 players. The innings will automatically close when fewer than 2 active batters remain capable of batting, eliminating the infinite "Batter Select" loop that previously occurred (e.g., a 5-player team is now correctly bowled out dynamically at 4 wickets).

## 📊 Scoreboard Enhancements
- **Retired Display:** Scoreboard no longer incorrectly displays bowler attribution (e.g. `b. BowlerName`) for `Retired Hurt` or `Retired Out` dismissals.
- **Hit Wicket Display:** Hit Wicket is seamlessly integrated and displayed accurately as `hit wicket b BowlerName` in the scorecard overview.
