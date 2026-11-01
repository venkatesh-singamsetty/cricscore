# --- S3 Match Backups ---
resource "aws_s3_bucket" "match_backups" {
  bucket_prefix = "${var.project_name}-match-backups-"
  # Backups and the ML model registry live here: never allow a prod destroy to wipe them.
  force_destroy = var.environment != "prod"

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "match_backups_block" {
  bucket = aws_s3_bucket.match_backups.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "match_backups_sse" {
  bucket = aws_s3_bucket.match_backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Tiered S3 Lifecycle Rules based on Resource Criticality:
# - Match Backups (backups/): Prod 90 days, Dev 14 days (aggressive)
# - Playwright E2E Reports (reports/): Prod 30 days, Dev 7 days (aggressive)
# - Dev Deployment SBOMs (sboms/dev/): 30 days (aggressive)
# - Release SBOMs (sboms/releases/) & ML models (models/): Deliberately NOT expired for audit & rollbacks.
resource "aws_s3_bucket_lifecycle_configuration" "match_backups" {
  bucket = aws_s3_bucket.match_backups.id

  rule {
    id     = "expire-match-backups"
    status = "Enabled"

    filter {
      prefix = "backups/"
    }

    expiration {
      days = var.environment == "prod" ? 90 : 14
    }
  }

  rule {
    id     = "expire-playwright-reports"
    status = "Enabled"

    filter {
      prefix = "reports/"
    }

    expiration {
      days = var.environment == "prod" ? 30 : 7
    }
  }

  rule {
    id     = "expire-dev-sboms"
    status = "Enabled"

    filter {
      prefix = "sboms/dev/"
    }

    expiration {
      days = 30
    }
  }

  rule {
    id     = "abort-incomplete-multipart-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = var.environment == "prod" ? 7 : 1
    }
  }
}

# --- CloudWatch Metric Alarms for 4.5 GB S3 Storage Quota (5 GB Free Tier Protection) ---
resource "aws_cloudwatch_metric_alarm" "s3_match_backups_storage_limit" {
  alarm_name          = "${var.project_name}-s3-match-backups-storage-limit"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BucketSizeBytes"
  namespace           = "AWS/S3"
  period              = "86400" # S3 storage metrics are emitted daily
  statistic           = "Average"
  threshold           = "4831838208" # 4.5 GiB (4.5 * 1024^3 bytes, 90% of 5 GB free tier)
  alarm_description   = "Triggers when S3 match backups bucket storage crosses 4.5 GiB, approaching the 5 GB AWS Free Tier limit."
  alarm_actions       = [aws_sns_topic.lambda_alerts.arn]

  dimensions = {
    BucketName  = aws_s3_bucket.match_backups.id
    StorageType = "StandardStorage"
  }
}

resource "aws_cloudwatch_metric_alarm" "s3_static_app_storage_limit" {
  alarm_name          = "${var.project_name}-s3-static-app-storage-limit"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "BucketSizeBytes"
  namespace           = "AWS/S3"
  period              = "86400"
  statistic           = "Average"
  threshold           = "4831838208" # 4.5 GiB
  alarm_description   = "Triggers when S3 static website hosting bucket crosses 4.5 GiB."
  alarm_actions       = [aws_sns_topic.lambda_alerts.arn]

  dimensions = {
    BucketName  = aws_s3_bucket.static_app.id
    StorageType = "StandardStorage"
  }
}

# --- S3 Versioned ML Model Registry ---
resource "aws_s3_object" "ml_model_joblib" {
  bucket       = aws_s3_bucket.match_backups.id
  key          = "models/${var.ml_model_version}/live_win_predictor_model.joblib"
  source       = "${path.module}/../../apps/ml-engine/live_win_predictor_model.joblib"
  etag         = filemd5("${path.module}/../../apps/ml-engine/live_win_predictor_model.joblib")
  content_type = "application/octet-stream"
}

resource "aws_s3_object" "ml_model_manifest" {
  bucket       = aws_s3_bucket.match_backups.id
  key          = "models/${var.ml_model_version}/model_manifest.json"
  source       = "${path.module}/../../apps/ml-engine/model_manifest.json"
  etag         = filemd5("${path.module}/../../apps/ml-engine/model_manifest.json")
  content_type = "application/json"
}

resource "aws_s3_object" "ml_model_metadata" {
  bucket       = aws_s3_bucket.match_backups.id
  key          = "models/${var.ml_model_version}/live_metadata.json"
  source       = "${path.module}/../../apps/ml-engine/live_metadata.json"
  etag         = filemd5("${path.module}/../../apps/ml-engine/live_metadata.json")
  content_type = "application/json"
}
