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

resource "aws_s3_bucket_public_access_block" "static_app_logs_block" {
  bucket = aws_s3_bucket.static_app_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
