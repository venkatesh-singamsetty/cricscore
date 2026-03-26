# 🚀 Release Notes: CricScore v1.3.1 - The Independence Milestone

This production patch marks the final transition from a "Single-Device" scoring app to an **Enterprise-Grade Multi-Tenant Platform**. v1.3.1 completely removes legacy PIN-based scoring in favor of a robust, email-scoped identity system that guarantees perfect isolation between different match scoring sessions.

## 🚦 Key Improvements & Security Hardening

### 1. **🔐 Multi-Tenant Identity & Isolation**
- **Email-Based Scorer Identity**: Replaced the legacy `VITE_SCORER_PIN` with a real-time email verification flow. This allows different officials to share the same hardware/tablet while maintaining strictly isolated match states.
- **Match-Specific Live Cache**: The ball-by-ball temporary scoring logs are now uniquely keyed to specific `matchId`s (`cric-live-match-{id}`). This eliminates "ghosting" where data from an old match would leak into a fresh game setup.
- **Atomic Session Resumption**: Scorers can safely logout and return later to find their match exactly where they left it, provided the match is still active in the database.

### 2. **🛰️ Persistent Cloud Synchronization**
- **Admin-Master Logic**: Implemented a real-time "Existence Check" (Heartbeat). If an Administrator deletes a match from the central dashboard, all Scorers currently scoring that match are instantly notified and their local workspace is forcibly purged to prevent data desync.
- **URL Sanitation**: Automated the removal of stale `?matchId=...` parameters from the browser address bar upon match load, start, or reset, preventing accidental state injection on page refreshes.

### 3. **📖 Zero-Config Clean Setup**
- **Legacy PIN Removal**: Deleted `VITE_SCORER_PIN` from the environment, source code, and deployment guides to simplify the onboarding experience for new match managers.
- **Unified Logout landing**: Standardized sign-out to always land users on the public **Viewer 🌍** mode for a consistent exit flow.

---
## 🛠️ Modified Components
- **`App.tsx`**: Migrated to email-scoped storage and implemented the 404 security "Kill-Switch."
- **`MatchView.tsx`**: Isolated live-scoring persistence to match-level keys.
- **`.env` & `docs/`**: Cleaned up legacy configuration variables and updated the engineering roadmap.

**Status:** 🚀 **PRODUCTION STABLE** (v1.3.1)
**Site URL:** [https://cricscore.venkateshsingamsetty.site](https://cricscore.venkateshsingamsetty.site) 🏏✨
