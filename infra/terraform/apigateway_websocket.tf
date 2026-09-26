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
  api_id             = aws_apigatewayv2_api.websocket_api.id
  route_key          = "$connect"
  target             = "integrations/${aws_apigatewayv2_integration.onconnect.id}"
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
  api_id             = aws_apigatewayv2_api.websocket_api.id
  route_key          = "$disconnect"
  target             = "integrations/${aws_apigatewayv2_integration.ondisconnect.id}"
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
  depends_on = [aws_api_gateway_account.apigateway_account]
}

# CloudWatch Log Group for WebSocket API access logs
resource "aws_cloudwatch_log_group" "ws_api_access_logs" {
  name              = "/aws/apigateway/${var.project_name}-ws"
  retention_in_days = 30
}

# Attach access logging to websocket stage


# --- Custom Domain for WebSocket API ---
resource "aws_acm_certificate" "ws_api" {
  domain_name       = "ws.${var.domain_name}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "ws_api_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.ws_api.domain_validation_options : dvo.domain_name => {
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

resource "aws_acm_certificate_validation" "ws_api" {
  certificate_arn         = aws_acm_certificate.ws_api.arn
  validation_record_fqdns = [for record in aws_route53_record.ws_api_cert_validation : record.fqdn]
}

resource "aws_apigatewayv2_domain_name" "ws_api" {
  domain_name = "ws.${var.domain_name}"

  domain_name_configuration {
    certificate_arn = aws_acm_certificate_validation.ws_api.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "ws_api" {
  api_id      = aws_apigatewayv2_api.websocket_api.id
  domain_name = aws_apigatewayv2_domain_name.ws_api.id
  stage       = aws_apigatewayv2_stage.websocket_stage.id
}

resource "aws_route53_record" "ws_api" {
  name    = aws_apigatewayv2_domain_name.ws_api.domain_name
  type    = "A"
  zone_id = data.aws_route53_zone.selected.zone_id

  alias {
    name                   = aws_apigatewayv2_domain_name.ws_api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.ws_api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}
