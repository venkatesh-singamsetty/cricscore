# 📦 S3 Storage Architecture, Lifecycle Policies & Quota Management

This document defines the storage topology, retention lifecycle rules, and quota monitoring for all Amazon S3 buckets in CricScore across both **Development (Dev)** and **Production (Prod)** environments.

---

## 🎯 1. Overview & Free-Tier Guardrails

- **AWS Free Tier S3 Quota**: **5.0 GB** of Amazon S3 Standard Storage, **20,000 GET** requests, and **2,000 PUT** requests per month.
- **Operating Target**: Keep total ongoing S3 storage across all buckets below **~500 MB (< 10% of Free Tier)** at **$0.00/month**.
- **Automated Safety Guardrail**: CloudWatch Metric Alarms actively monitor storage usage daily and trigger immediate SNS email alerts to `admin_email` if any S3 bucket crosses **4.5 GiB (90% capacity)**.

```
AWS Free Tier S3 Standard Storage (5.0 GB Total)
┌────────────────────────────────────────────────────────┬──────────────┐
│  CricScore Active Footprint (~250 MB - 500 MB)         │ Safety Buffer│
│  [Match Backups | ML Registry | SBOMs | Reports | CDN] │ (4.0 - 4.5GB)│
└────────────────────────────────────────────────────────┴──────────────┘
                                                         ▲
                                                         │ CloudWatch Alarm Threshold
                                                         │ (4.5 GiB / 4,831,838,208 bytes)
```

---

## 🗄️ 2. S3 Bucket Inventory

| Environment | Bucket Purpose                        | Bucket Name Pattern            | Versioning | Encryption      | Public Access       |
| :---------- | :------------------------------------ | :----------------------------- | :--------- | :-------------- | :------------------ |
| **Dev**     | Match Backups, Models, SBOMs, Reports | `cricscoredev-match-backups-*` | Disabled   | AES256 (SSE-S3) | Fully Blocked       |
| **Dev**     | Static Website Hosting                | `cricscoredev-app-*`           | Enabled    | AES256 (SSE-S3) | Fully Blocked (OAC) |
| **Dev**     | CloudFront & S3 Access Logs           | `cricscoredev-app-logs-*`      | Disabled   | AES256 (SSE-S3) | Fully Blocked       |
| **Prod**    | Match Backups, Models, SBOMs, Reports | `cricscore-match-backups-*`    | Disabled   | AES256 (SSE-S3) | Fully Blocked       |
| **Prod**    | Static Website Hosting                | `cricscore-app-*`              | Enabled    | AES256 (SSE-S3) | Fully Blocked (OAC) |
| **Prod**    | CloudFront & S3 Access Logs           | `cricscore-app-logs-*`         | Disabled   | AES256 (SSE-S3) | Fully Blocked       |
| **Global**  | Terraform Remote State                | `venky-2026-terraform-state`   | Enabled    | AES256 (SSE-S3) | Fully Blocked       |

---

## ⏱️ 3. Tiered Cleanup Lifecycle Matrix

Retention policies are intentionally differentiated based on **resource criticality** and **environment**. Dev environments clean up aggressively to eliminate test bloat, while Prod retains data with measured leniency for compliance and recovery.

| Resource Category                | S3 Prefix / Path      | Criticality     | Dev Retention (Aggressive) | Prod Retention (Lenient)      | Rationale & Protection                                                                                  |
| :------------------------------- | :-------------------- | :-------------- | :------------------------- | :---------------------------- | :------------------------------------------------------------------------------------------------------ |
| **Playwright E2E Reports**       | `reports/playwright/` | 🟡 Low          | **7 Days**                 | **30 Days**                   | Ephemeral CI test results & HTML traces. `latest/` is overwritten on each deploy.                       |
| **Match Event Backups**          | `backups/`            | 🟠 Medium       | **14 Days**                | **90 Days**                   | Raw JSON match state dumps from Lambda. Dev matches are disposable; Prod kept for quarterly recovery.   |
| **Dev Post-Deploy SBOMs**        | `sboms/dev/`          | 🟠 Medium       | **30 Days**                | _N/A_                         | Generated only after successful DEV deployment in `ci.yml`; auto-expired after 30 days.                 |
| **Prod Release SBOMs**           | `sboms/releases/`     | 🟢 High (Audit) | _N/A_                      | **Permanent (Never Expired)** | Generated only after successful PROD deployment in `cd.yml` & attached to GitHub release. ~300 KB each. |
| **ML Model Registry**            | `models/`             | 🔴 Critical     | **Permanent**              | **Permanent (Never Expired)** | Serialized XGBoost model weights (`.joblib`), manifests, and metadata for live inference & rollbacks.   |
| **Access Logs**                  | `*` (in logs bucket)  | 🟡 Low          | **7 Days**                 | **30 Days**                   | CloudFront CDN and S3 HTTP access logs used solely for short-term operational debugging.                |
| **Noncurrent App Versions**      | `*` (in app bucket)   | 🟠 Medium       | **3 Days**                 | **7 Days**                    | Prior frontend static bundle versions retained briefly in case of an immediate UI rollback.             |
| **Incomplete Multipart Uploads** | _All Buckets_         | ⚪ Waste        | **1 Day**                  | **7 Days**                    | Aborted uploads purged automatically to eliminate orphaned byte billing.                                |

---

## 🚨 4. CloudWatch 4.5 GB Storage Quota Monitoring

AWS CloudWatch reports `BucketSizeBytes` metrics once every 24 hours under the `AWS/S3` namespace (`StorageType = "StandardStorage"`).

### Alarm Specifications

- **Alarm Names**:
  - `${var.project_name}-s3-match-backups-storage-limit`
  - `${var.project_name}-s3-static-app-storage-limit`
- **Threshold**: `4,831,838,208` bytes (**4.5 GiB**, 90% of the 5.0 GB Free Tier ceiling)
- **Evaluation Period**: 1 period of 86,400 seconds (1 day)
- **Comparison Operator**: `GreaterThanThreshold`
- **Notification Destination**: `aws_sns_topic.lambda_alerts` → Email dispatch to `var.admin_email`

### Emergency Runbook: If a 4.5 GB Alert Fires

1. **Identify High-Usage Bucket & Prefixes**:
   ```bash
   aws s3 ls s3://cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d --recursive --summarize --human-readable
   ```
2. **Review Storage by Resource Class**:
   ```bash
   # Check reports usage
   aws s3 ls s3://cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d/reports/ --recursive --summarize --human-readable
   # Check backups usage
   aws s3 ls s3://cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d/backups/ --recursive --summarize --human-readable
   ```
3. **Manually Flush Ephemeral Test Reports if Needed**:
   ```bash
   aws s3 rm s3://cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d/reports/playwright/ --recursive
   ```

---

## 💻 5. Operator Guide: Downloading & Inspecting Artifacts

### A. Inspect Live Playwright Reports from S3

```bash
# 1. Download the latest Prod Playwright report
mkdir -p /tmp/playwright-prod && aws s3 sync s3://cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d/reports/playwright/latest/ /tmp/playwright-prod/

# 2. View in browser
npx playwright show-report /tmp/playwright-prod
```

### B. Download Production Release SBOM

```bash
# Download latest production release SBOM
aws s3 cp s3://cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d/sboms/latest.spdx.json ./cricscore-prod-sbom.json
```

### C. Download Champion ML Model Artifacts

```bash
# Download model binary and manifest
aws s3 cp s3://cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d/models/v2.2.0/live_win_predictor_model.joblib ./
aws s3 cp s3://cricscore-match-backups-0dd0d65575f13cfa1e7a7f820d/models/v2.2.0/model_manifest.json ./
```

---

## 🔒 6. Zero-Cost Verification

- **S3 Standard Storage**: Free up to 5 GB. Current usage: `< 0.3 GB` ($0.00).
- **S3 Requests**: Free up to 2,000 PUT / 20,000 GET per month. Standard CI/CD operations utilize `< 300 requests/month` ($0.00).
- **CloudWatch Alarms**: AWS Free Tier includes 10 standard metric alarms per month; CricScore utilizes 4 total ($0.00).
