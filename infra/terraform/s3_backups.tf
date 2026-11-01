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

# Raw match backups (backups/*) are expired after 180 days. The models/ prefix
# (ML model registry used for rollbacks) is deliberately NOT expired.
resource "aws_s3_bucket_lifecycle_configuration" "match_backups" {
  bucket = aws_s3_bucket.match_backups.id

  rule {
    id     = "expire-old-match-backups"
    status = "Enabled"

    filter {
      prefix = "backups/"
    }

    expiration {
      days = 180
    }
  }

  rule {
    id     = "abort-incomplete-multipart-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
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
