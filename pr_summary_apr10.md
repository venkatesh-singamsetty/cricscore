# PR: CricScore — Bug Fixes & Data Integrity

**Branch:** `develop` → `main` · **Commit:** `502afab` · **April 10, 2026**

## What Changed

| # | Fix | Files |
|---|---|---|
| 1 | **Wrong innings scores on match hub** — scores were shown under the wrong team when the visiting team batted first | `MatchList.tsx` |
| 2 | **`innings.is_completed` never set** — now marked `TRUE` when innings 1 ends and again on match completion | `match-api/index.js` |
| 3 | **`match_winner` never saved to DB** — persisted on match completion via PATCH | `App.tsx`, `match-api/index.js` |
| 4 | **Email showed "MATCH IN PROGRESS"** — race condition fixed by deriving result from frontend state instead of DB | `match-api/index.js` |
| 5 | **Viewer hub not updated when 2nd innings starts** — added WebSocket broadcast on innings 2 creation | `match-api/index.js` |

## Deploy Note
> `match-api` Lambda requires a **redeploy** for backend changes to take effect.
