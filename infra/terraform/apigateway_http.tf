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
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.http_api_access_logs.arn
    format          = "$context.requestId $context.identity.sourceIp $context.requestTime $context.routeKey $context.status"
  }
  depends_on = [aws_api_gateway_account.apigateway_account]
}

resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.http_api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-authorizer"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.client.id]
    issuer   = "https://${aws_cognito_user_pool.pool.endpoint}"
  }
}

# CloudWatch Log Group for API Gateway HTTP access logs
resource "aws_cloudwatch_log_group" "http_api_access_logs" {
  name              = "/aws/apigateway/${var.project_name}-http"
  retention_in_days = 30
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
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "POST /match"
  target             = "integrations/${aws_apigatewayv2_integration.match_api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "get_match" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /match/{matchId}"
  target             = "integrations/${aws_apigatewayv2_integration.match_api.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "get_match_details" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /match/{matchId}/details"
  target             = "integrations/${aws_apigatewayv2_integration.match_api.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "get_matches" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /matches"
  target             = "integrations/${aws_apigatewayv2_integration.match_api.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "patch_match" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "PATCH /match/{matchId}"
  target             = "integrations/${aws_apigatewayv2_integration.match_api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "post_innings" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "POST /match/{matchId}/innings"
  target             = "integrations/${aws_apigatewayv2_integration.match_api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "delete_matches" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "DELETE /matches"
  target             = "integrations/${aws_apigatewayv2_integration.match_api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "delete_match" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "DELETE /match/{matchId}"
  target             = "integrations/${aws_apigatewayv2_integration.match_api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "post_match_email" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "POST /match/{matchId}/email"
  target             = "integrations/${aws_apigatewayv2_integration.match_api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "post_admin_roles" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "POST /admin/users/roles"
  target             = "integrations/${aws_apigatewayv2_integration.match_api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "get_admin_users" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /admin/users"
  target             = "integrations/${aws_apigatewayv2_integration.match_api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "delete_admin_roles" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "DELETE /admin/users/roles"
  target             = "integrations/${aws_apigatewayv2_integration.match_api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "delete_admin_users" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "DELETE /admin/users"
  target             = "integrations/${aws_apigatewayv2_integration.match_api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "delete_admin_users_guests" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "DELETE /admin/users/guests"
  target             = "integrations/${aws_apigatewayv2_integration.match_api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "delete_admin_matches_guests" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "DELETE /admin/matches/guests"
  target             = "integrations/${aws_apigatewayv2_integration.match_api.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_apigatewayv2_route" "get_health" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /health"
  target             = "integrations/${aws_apigatewayv2_integration.match_api.id}"
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.match_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
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
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "POST /update-score"
  target             = "integrations/${aws_apigatewayv2_integration.score_update.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

resource "aws_lambda_permission" "api_gw_score" {
  statement_id  = "AllowExecutionFromAPIGatewayScore"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.score_update.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "chat_api" {
  api_id           = aws_apigatewayv2_api.http_api.id
  integration_type = "AWS_PROXY"

  connection_type    = "INTERNET"
  description        = "Chat API Lambda Integration"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.chat_api.invoke_arn
}

resource "aws_apigatewayv2_route" "post_chat" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "POST /chat"
  target             = "integrations/${aws_apigatewayv2_integration.chat_api.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "post_chat_summary" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "POST /chat/summary"
  target             = "integrations/${aws_apigatewayv2_integration.chat_api.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "post_rules_upload" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "POST /rules/upload"
  target             = "integrations/${aws_apigatewayv2_integration.chat_api.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "get_rules" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /rules"
  target             = "integrations/${aws_apigatewayv2_integration.chat_api.id}"
  authorization_type = "NONE"
}

resource "aws_apigatewayv2_route" "delete_rules" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "DELETE /rules"
  target             = "integrations/${aws_apigatewayv2_integration.chat_api.id}"
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "api_gw_chat" {
  statement_id  = "AllowExecutionFromAPIGatewayChat"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.chat_api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# --- Custom Domain for HTTP API ---
resource "aws_acm_certificate" "http_api" {
  domain_name       = "api.${var.domain_name}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "http_api_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.http_api.domain_validation_options : dvo.domain_name => {
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

resource "aws_acm_certificate_validation" "http_api" {
  certificate_arn         = aws_acm_certificate.http_api.arn
  validation_record_fqdns = [for record in aws_route53_record.http_api_cert_validation : record.fqdn]
}

resource "aws_apigatewayv2_domain_name" "http_api" {
  domain_name = "api.${var.domain_name}"

  domain_name_configuration {
    certificate_arn = aws_acm_certificate_validation.http_api.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "http_api" {
  api_id      = aws_apigatewayv2_api.http_api.id
  domain_name = aws_apigatewayv2_domain_name.http_api.id
  stage       = aws_apigatewayv2_stage.default.id
}

resource "aws_route53_record" "http_api" {
  name    = aws_apigatewayv2_domain_name.http_api.domain_name
  type    = "A"
  zone_id = data.aws_route53_zone.selected.zone_id

  alias {
    name                   = aws_apigatewayv2_domain_name.http_api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.http_api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}
