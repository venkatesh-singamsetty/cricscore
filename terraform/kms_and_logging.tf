// KMS key for encrypting S3, SNS, SQS
data "aws_caller_identity" "current" {}

resource "aws_kms_key" "cric_key" {
  description             = "KMS key for ${var.project_name} resources"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "Allow administration of the key"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "Allow SNS and SQS use of the key"
        Effect    = "Allow"
        Principal = { Service = ["sns.amazonaws.com", "sqs.amazonaws.com"] }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    Project = var.project_name
  }
}

resource "aws_kms_alias" "cric_key_alias" {
  name          = "alias/${var.project_name}-kms"
  target_key_id = aws_kms_key.cric_key.key_id
}

// Logging bucket for S3 access logs
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
