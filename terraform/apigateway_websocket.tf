# WebSocket API Gateway
resource "aws_apigatewayv2_api" "websocket_api" {
  name                       = "${var.project_name}-websocket-api"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

# Integration for onConnect
resource "aws_apigatewayv2_integration" "onconnect" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.onconnect.invoke_arn
}

resource "aws_apigatewayv2_route" "onconnect" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.onconnect.id}"
  authorization_type = "NONE"
}

resource "aws_lambda_permission" "websocket_onconnect" {
  statement_id  = "AllowExecutionFromAPIGatewayOnConnect"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.onconnect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*/*"
}

# Integration for onDisconnect
resource "aws_apigatewayv2_integration" "ondisconnect" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.ondisconnect.invoke_arn
}

resource "aws_apigatewayv2_route" "ondisconnect" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.ondisconnect.id}"
  authorization_type = "NONE"
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
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.ws_api_access_logs.arn
    format          = "$context.requestId $context.identity.sourceIp $context.requestTime $context.routeKey $context.status"
  }
}

# CloudWatch Log Group for WebSocket API access logs
resource "aws_cloudwatch_log_group" "ws_api_access_logs" {
  name              = "/aws/apigateway/${var.project_name}-ws"
  retention_in_days = 30
}

# Attach access logging to websocket stage

