# trivy:ignore:AWS-0132 (CMK costs $1/mo, using free SSE-S3/SSE-SQS/SSE-SNS instead)

// Logging bucket for S3 access logs
# trivy:ignore:AWS-0132 (CMK costs $1/mo, using free SSE-S3)
resource "aws_s3_bucket" "static_app_logs" {
  bucket_prefix = "${var.project_name}-app-logs-"
  force_destroy = true

  tags = {
    Project = var.project_name
  }
}

# S3 access logs are only useful for short-term debugging; expire them.
resource "aws_s3_bucket_lifecycle_configuration" "static_app_logs" {
  bucket = aws_s3_bucket.static_app_logs.id

  rule {
    id     = "expire-access-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = 30
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_public_access_block" "static_app_logs_block" {
  bucket = aws_s3_bucket.static_app_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
