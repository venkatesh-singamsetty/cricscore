output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.s3_distribution.id
}

output "website_url" {
  value = "https://${var.domain_name}"
}

output "dynamodb_connections_table" {
  value = aws_dynamodb_table.connections.name
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.pool.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.client.id
}

output "cognito_domain" {
  value = aws_cognito_user_pool_domain.domain.domain
}

output "s3_bucket_name" {
  value = aws_s3_bucket.static_app.id
}

output "http_api_url" {
  value = "https://${aws_apigatewayv2_domain_name.http_api.domain_name}"
}

output "websocket_url" {
  value = "wss://${aws_apigatewayv2_domain_name.ws_api.domain_name}"
}
