# 📅 CricScore: Full Project Timeline & Release Log

This document tracks the complete evolutionary history of the CricScore platform.

---

## ⚡ v2.1.0: Complete Kafka & mTLS Cleanup [2026-06-16]
* **Decoupled Architecture Consolidation**: Removed all references, environment configuration variables, and dependencies on Apache Kafka (`kafkajs`). The platform now operates purely on the AWS SNS + SQS fan-out buffer.
* **Credential Cleanup**: Deleted 6 obsolete secrets (`KAFKA_CA_CERT_B64`, `KAFKA_CERT_B64`, `KAFKA_KEY_B64`, `TF_KAFKA_BROKERS`, `TF_KAFKA_PASSWORD`, `TF_KAFKA_USERNAME`) from the GitHub Repository Actions secrets.
* **Certificate Purge**: Deleted all local untracked `.pem` files in lambda compute and certificates directories to prevent deployment bundle bloat.
* **Broadcaster Lambda**: Renamed legacy `kafka-consumer` lambda to `broadcaster` in both folder structures and Terraform configuration, aligning the codebase with its true functional purpose (fast-path SNS-to-WebSocket fan-out).

---

## 🏏 v2.0.2: Timeline Standardization & Cricket Laws Compliance [2026-06-16]
* **Standardized Event Timeline**: Harmonized timeline display across both completed scorecards and live scorers. All special events now display as `<Type>` or `<Type>+<runs>` (e.g., `W`, `W+1`, `Wd`, `Wd+1`, `Nb`, `Nb+2`, `B+1`, `Lb+1`).
* **Bowler Wicket Crediting**: Corrected scoring rules off extra deliveries. Stumpings and Hit Wickets off Wide deliveries are now correctly credited as wickets to the Bowler, whereas other wickets off extras (such as run outs) are not.
* **No-Ball Dismissal Restrictions**: Disabled caught-out options off No-balls in accordance with the Laws of Cricket. Only valid dismissals (such as Run Out) are permitted.
* **API Routing & IAM Permissions**: Resolved email dispatch failures by appending `ses:SendEmail` and `ses:SendRawEmail` actions to the Lambda role and adding missing `DELETE /match/{matchId}` and `POST /match/{matchId}/email` routes to the API Gateway.

---

## 👥 v2.0.1: Team Sizes, Quotas & Scoreboard Enhancements [2026-06-05]
* **Custom Team Sizes & All-Out Logic**: Added dynamic innings end detection for teams with fewer than 11 players. Innings end automatically when fewer than 2 active batters remain capable of batting, preventing infinite select loops.
* **Bowler Over Quotas**: Enforced over-quotas (`Total Match Overs / 5`) with UI warnings and disabled selects.
* **Maiden Over Detection**: Fixed overs containing Wides or No-balls being counted as maidens.
* **Scorecard Display**: Integrated Hit Wicket display formats and fixed Retired Hurt showing bowler attribution.

---

## ⚡ v2.0.0: Decoupled Fan-Out Architecture [2026-03-31]
* **AWS SNS Event Hub**: Completely decoupled the `score-update` lambda from synchronous database writes, allowing Scorers to experience sub-100ms UI response times.
* **AWS SQS Reliability Buffer**: Implemented an asynchronous message queue to protect Aiven PostgreSQL from match-day ingestion spikes.
* **Storage Worker**: Provisioned a dedicated serverless worker to handle all ACID-compliant persistence and event scheduling.
* **Universal Broadcaster Hub**: Refactored the WebSocket broadcaster to instantly trigger directly from SNS payloads, bypassing traditional data indexing latency.
* **Infrastructure Integrity Fixes**: Resolved strict Node v18 Aiven TLS rejections (`SELF_SIGNED_CERT_IN_CHAIN`), fully automated deployment hydration boundaries, and structurally debounced React `useRef` race conditions during high-impact rapid scoring bursts.

---

## 🐛 v1.6.0: Bug Fixes & Data Integrity [2026-04-10]
* **Match Hub Innings Scores**: Fixed scores displaying under the incorrect team when the visiting team batted first.
* **Innings Completion States**: Ensured `is_completed` is set to `TRUE` on innings end and match completion.
* **Winner Persistence**: Persisted `match_winner` to PostgreSQL upon match completion.
* **Email Race Conditions**: Derived final email results directly from the frontend state to ensure accurate "Completed" statuses.
* **Viewer Hub WS Synchronizations**: Added live WebSocket updates when a new 2nd innings starts.

---

## 📜 Historical Changelog (v1.0.0 - v1.5.2)

* **2026-03-30 (v1.5.2)**: **Deep-Link Restoration & Sharing Finalization**: Sharable links (`?matchId=xxx`) instantly route to active scoreboards.
* **2026-03-30 (v1.5.0)**: **Strategic Pivot: Viral Sharing**: Transitioned from email-only reporting to an Instant Sharable Match Link system.
* **2026-03-26 (v1.4.0)**: **Production Release**: Decoupled Admin and Scorer email dispatch to bypass SES Sandbox restrictions.
* **2026-03-26 (v1.3.0)**: **Enterprise Multi-Tenant Isolation**: Implemented per-user match persistence and match-specific live caches.
* **2026-03-25 (v1.2.0)**: **Production Release**: Finalized production convergence from `develop` to `main`.
* **2026-03-23 (v1.1.0)**: **Persistence & UI Patches**: Fixed "empty analytics" bug and "white screen" spectator views by adding React keys and forced tab-refreshing.
* **2026-03-22 (v1.0.0)**: **Kickoff**: Aiven PostgreSQL persistence and real-time WebSocket broadcasting verified.
