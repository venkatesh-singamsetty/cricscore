# --- S3 Match Backups ---
resource "aws_s3_bucket" "match_backups" {
  bucket_prefix = "${var.project_name}-match-backups-"
  force_destroy = true

  tags = {
    Project = var.project_name
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
