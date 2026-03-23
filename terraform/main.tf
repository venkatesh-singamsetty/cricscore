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

resource "aws_s3_bucket_public_access_block" "static_app" {
  bucket = aws_s3_bucket.static_app.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
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
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
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
  zone_id = data.aws_route53_zone.selected.zone_id
  name    = var.subdomain_prefix
  type    = "A"

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

# --- 6. DynamoDB Table for WebSocket Connections ---
resource "aws_dynamodb_table" "connections" {
  name           = "${var.project_name}-connections"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }

  tags = {
    Project = var.project_name
  }
}

# --- 7. IAM Role for Lambda Functions ---
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Add policy for DynamoDB access
resource "aws_iam_policy" "lambda_dynamo" {
  name        = "${var.project_name}-lambda-dynamo"
  description = "Allows Lambda to manage connections in DynamoDB"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action   = ["dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:GetItem", "dynamodb:Scan"]
        Effect   = "Allow"
        Resource = aws_dynamodb_table.connections.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_dynamo_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_dynamo.arn
}

# --- 8. Match API Lambda Function ---

# Archive for deployment
data "archive_file" "match_api_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/lambdas/match-api"
  output_path = "${path.module}/match_api.zip"
}

resource "aws_lambda_function" "match_api" {
  filename         = data.archive_file.match_api_zip.output_path
  function_name    = "${var.project_name}-match-api"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  source_code_hash = data.archive_file.match_api_zip.output_base64sha256

  environment {
    variables = {
      DATABASE_URL = var.database_url
    }
  }

  tags = {
    Project = var.project_name
  }
}

# --- 9. API Gateway (HTTP) ---
resource "aws_apigatewayv2_api" "http_api" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["*"]
    allow_headers = ["*"]
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

# Integration for Match API
resource "aws_apigatewayv2_integration" "match_api" {
  api_id           = aws_apigatewayv2_api.http_api.id
  integration_type = "AWS_PROXY"

  connection_type    = "INTERNET"
  description        = "Match API Lambda Integration"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.match_api.invoke_arn
}

# Routes for Match API
resource "aws_apigatewayv2_route" "post_match" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "POST /match"
  target    = "integrations/${aws_apigatewayv2_integration.match_api.id}"
}

resource "aws_apigatewayv2_route" "get_match" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /match/{matchId}"
  target    = "integrations/${aws_apigatewayv2_integration.match_api.id}"
}

resource "aws_apigatewayv2_route" "get_match_details" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /match/{matchId}/details"
  target    = "integrations/${aws_apigatewayv2_integration.match_api.id}"
}

resource "aws_apigatewayv2_route" "get_matches" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "GET /matches"
  target    = "integrations/${aws_apigatewayv2_integration.match_api.id}"
}

resource "aws_apigatewayv2_route" "patch_match" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "PATCH /match/{matchId}"
  target    = "integrations/${aws_apigatewayv2_integration.match_api.id}"
}

resource "aws_apigatewayv2_route" "post_innings" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "POST /match/{matchId}/innings"
  target    = "integrations/${aws_apigatewayv2_integration.match_api.id}"
}

resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.match_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# --- 10. Score Update (Kafka Producer) Lambda ---

data "archive_file" "score_update_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/lambdas/score-update"
  output_path = "${path.module}/score_update.zip"
}

resource "aws_lambda_function" "score_update" {
  filename         = data.archive_file.score_update_zip.output_path
  function_name    = "${var.project_name}-score-upd"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  memory_size      = 256
  source_code_hash = data.archive_file.score_update_zip.output_base64sha256
  timeout          = 30

  environment {
    variables = {
      DATABASE_URL       = var.database_url
      KAFKA_BROKERS      = var.kafka_bootstrap_servers
      KAFKA_USERNAME     = var.kafka_username
      KAFKA_PASSWORD     = var.kafka_password
      BROADCASTER_LAMBDA = aws_lambda_function.kafka_consumer.arn
    }
  }

  tags = {
    Project = var.project_name
  }
}

# Integration for Score Update API
resource "aws_apigatewayv2_integration" "score_update" {
  api_id           = aws_apigatewayv2_api.http_api.id
  integration_type = "AWS_PROXY"

  connection_type    = "INTERNET"
  description        = "Score Update Lambda Integration"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.score_update.invoke_arn
}

resource "aws_apigatewayv2_route" "post_score_update" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "POST /update-score"
  target    = "integrations/${aws_apigatewayv2_integration.score_update.id}"
}

resource "aws_lambda_permission" "api_gw_score" {
  statement_id  = "AllowExecutionFromAPIGatewayScore"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.score_update.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# WebSocket API Gateway
resource "aws_apigatewayv2_api" "websocket_api" {
  name                       = "${var.project_name}-websocket-api"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

# --- onConnect Lambda ---
data "archive_file" "onconnect_zip" {
  type        = "zip"
  source_file = "${path.module}/../backend/lambdas/onconnect/index.js"
  output_path = "${path.module}/onconnect.zip"
}

resource "aws_lambda_function" "onconnect" {
  filename         = data.archive_file.onconnect_zip.output_path
  function_name    = "${var.project_name}-onconnect"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  source_code_hash = data.archive_file.onconnect_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.connections.name
    }
  }
}

resource "aws_apigatewayv2_integration" "onconnect" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.onconnect.invoke_arn
}

resource "aws_apigatewayv2_route" "onconnect" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.onconnect.id}"
}

resource "aws_lambda_permission" "websocket_onconnect" {
  statement_id  = "AllowExecutionFromAPIGatewayOnConnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.onconnect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*/*"
}

# --- onDisconnect Lambda ---
data "archive_file" "ondisconnect_zip" {
  type        = "zip"
  source_file = "${path.module}/../backend/lambdas/ondisconnect/index.js"
  output_path = "${path.module}/ondisconnect.zip"
}

resource "aws_lambda_function" "ondisconnect" {
  filename         = data.archive_file.ondisconnect_zip.output_path
  function_name    = "${var.project_name}-ondisconnect"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  source_code_hash = data.archive_file.ondisconnect_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.connections.name
    }
  }
}

resource "aws_apigatewayv2_integration" "ondisconnect" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.ondisconnect.invoke_arn
}

resource "aws_apigatewayv2_route" "ondisconnect" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.ondisconnect.id}"
}

resource "aws_lambda_permission" "websocket_ondisconnect" {
  statement_id  = "AllowExecutionFromAPIGatewayOnDisconnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ondisconnect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*/*"
}

# WebSocket Stage
resource "aws_apigatewayv2_stage" "websocket_stage" {
  api_id      = aws_apigatewayv2_api.websocket_api.id
  name        = "prod"
  auto_deploy = true
}

# --- Kafka Consumer Lambda ---
data "archive_file" "kafka_consumer_zip" {
  type        = "zip"
  source_file = "${path.module}/../backend/lambdas/kafka-consumer/index.js"
  output_path = "${path.module}/kafka_consumer.zip"
}

resource "aws_lambda_function" "kafka_consumer" {
  filename         = data.archive_file.kafka_consumer_zip.output_path
  function_name    = "${var.project_name}-kafka-consumer"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  source_code_hash = data.archive_file.kafka_consumer_zip.output_base64sha256

  environment {
    variables = {
      TABLE_NAME    = aws_dynamodb_table.connections.name
      WEBSOCKET_URL = "${aws_apigatewayv2_api.websocket_api.api_endpoint}/prod"
    }
  }
}

# IAM Policy for WebSocket Broadcasting
resource "aws_iam_policy" "lambda_websocket" {
  name        = "${var.project_name}-lambda-websocket"
  description = "Allow Lambda to post to WebSocket connections"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "execute-api:ManageConnections"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:execute-api:${var.aws_region}:*:*/*/*/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_websocket_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_websocket.arn
}

# IAM Policy for Lambda Invocation (Fast-Path)
resource "aws_iam_policy" "lambda_invoke" {
  name        = "${var.project_name}-lambda-invoke"
  description = "Allow Lambda to trigger other Lambdas"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "lambda:InvokeFunction"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:lambda:${var.aws_region}:*:function:*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_invoke_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_invoke.arn
}

output "websocket_url" {
  value = "wss://${aws_apigatewayv2_api.websocket_api.id}.execute-api.${var.aws_region}.amazonaws.com/prod"
}
