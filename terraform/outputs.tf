output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.s3_distribution.id
}

output "website_url" {
  value = "https://${var.domain_name}"
}

output "s3_bucket_name" {
  value = aws_s3_bucket.static_app.id
}

output "http_api_url" {
  value = "https://${aws_apigatewayv2_api.http_api.id}.execute-api.${var.aws_region}.amazonaws.com"
}

output "websocket_url" {
  value = "wss://${aws_apigatewayv2_api.websocket_api.id}.execute-api.${var.aws_region}.amazonaws.com/prod"
}
