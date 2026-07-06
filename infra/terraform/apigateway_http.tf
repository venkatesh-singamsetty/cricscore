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
