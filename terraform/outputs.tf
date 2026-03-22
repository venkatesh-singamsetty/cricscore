output "s3_bucket_name" {
  description = "The name of the S3 bucket where the app is hosted"
  value       = aws_s3_bucket.static_app.bucket
}

output "website_url" {
  description = "The URL of the deployed application"
  value       = "https://${var.domain_name}"
}

output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.s3_distribution.id
}
