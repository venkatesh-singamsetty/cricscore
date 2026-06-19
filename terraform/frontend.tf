# --- 0. Data for Existing Route53 Zone ---
data "aws_route53_zone" "selected" {
  name         = var.zone_domain
  private_zone = false
}

# --- 1. S3 Bucket for Static Website ---
resource "aws_s3_bucket" "static_app" {
  bucket_prefix = "${var.project_name}-app-"
  force_destroy = true

  tags = {
    Project = var.project_name
  }
}

resource "aws_s3_bucket_versioning" "static_app_versioning" {
  bucket = aws_s3_bucket.static_app.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static_app_sse" {
  bucket = aws_s3_bucket.static_app.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.cric_key.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_logging" "static_app_access_logs" {
  bucket = aws_s3_bucket.static_app.id
  target_bucket = aws_s3_bucket.static_app_logs.id
  target_prefix = "access-logs/"
}

resource "aws_s3_bucket_public_access_block" "static_app" {
  bucket = aws_s3_bucket.static_app.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "static_app" {
  bucket = aws_s3_bucket.static_app.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}


# --- 2. ACM Certificate (SSL) ---
resource "aws_acm_certificate" "cert" {
  provider          = aws.us-east-1
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Project = var.project_name
  }
}

# --- 2a. Automated Route53 Validation Record ---
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.cert.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.selected.zone_id
}

resource "aws_acm_certificate_validation" "cert" {
  provider                = aws.us-east-1
  certificate_arn         = aws_acm_certificate.cert.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

# --- 3. CloudFront Origin Access Control (OAC) ---
resource "aws_cloudfront_origin_access_control" "default" {
  name                              = "${var.project_name}-oac"
  description                       = "OAC for ${var.project_name} S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# --- 4. CloudFront Distribution ---
resource "aws_cloudfront_distribution" "s3_distribution" {
  origin {
    domain_name              = aws_s3_bucket.static_app.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.default.id
    origin_id                = "S3-Origin"
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  aliases = [var.domain_name]

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-Origin"

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Headers", "Access-Control-Request-Method"]
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.cert.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  tags = {
    Project = var.project_name
  }
}

# --- 4a. Route53 Alias Record for the Subdomain ---
resource "aws_route53_record" "www" {
  allow_overwrite = true
  zone_id         = data.aws_route53_zone.selected.zone_id
  name            = var.subdomain_prefix
  type            = "A"

  alias {
    name                   = aws_cloudfront_distribution.s3_distribution.domain_name
    zone_id                = aws_cloudfront_distribution.s3_distribution.hosted_zone_id
    evaluate_target_health = false
  }
}

# --- 5. S3 Bucket Policy to allow CloudFront ---
resource "aws_s3_bucket_policy" "allow_cloudfront" {
  bucket = aws_s3_bucket.static_app.id
  policy = data.aws_iam_policy_document.allow_cloudfront_access.json
}

// Optional: Response headers policy for CloudFront to improve security
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name = "${var.project_name}-security-headers"

  security_headers_config {
    content_security_policy {
      override            = true
      content_security_policy = "default-src 'self'; img-src 'self' data: https:; script-src 'self' https:; style-src 'self' https:"
    }

    xss_protection {
      protection = true
      mode_block  = true
      override    = true
    }

    referrer_policy {
      override = true
      referrer_policy = "no-referrer"
    }

    strictly_transport_security {
      override = true
      include_subdomains = true
      preload = true
      access_control_max_age_sec = 63072000
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }
  }
}

// (response headers policy attached via `default_cache_behavior.response_headers_policy_id`)

data "aws_iam_policy_document" "allow_cloudfront_access" {
  statement {
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions = [
      "s3:GetObject"
    ]

    resources = [
      "${aws_s3_bucket.static_app.arn}/*"
    ]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.s3_distribution.arn]
    }
  }
}
