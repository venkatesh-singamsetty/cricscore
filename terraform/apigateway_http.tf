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

resource "aws_apigatewayv2_route" "delete_matches" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "DELETE /matches"
  target    = "integrations/${aws_apigatewayv2_integration.match_api.id}"
}

resource "aws_apigatewayv2_route" "delete_match" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "DELETE /match/{matchId}"
  target    = "integrations/${aws_apigatewayv2_integration.match_api.id}"
}

resource "aws_apigatewayv2_route" "post_match_email" {
  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = "POST /match/{matchId}/email"
  target    = "integrations/${aws_apigatewayv2_integration.match_api.id}"
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
