# --- 8. Match API Lambda Function ---
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

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      DATABASE_URL       = var.database_url
      SES_SOURCE         = var.ses_source_email
      ADMIN_REPORT_EMAIL = var.admin_email
      BROADCASTER_LAMBDA = aws_lambda_function.score_update.function_name
      FRONTEND_URL       = "https://${var.domain_name}"
    }
  }

  tags = {
    Project = var.project_name
  }
}

# --- 10. Score Update Lambda ---
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

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      MATCH_EVENTS_TOPIC = aws_sns_topic.match_events.arn
    }
  }

  tags = {
    Project = var.project_name
  }
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

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.connections.name
    }
  }
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

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.connections.name
    }
  }
}

# --- WebSocket Broadcaster Lambda ---
data "archive_file" "broadcaster_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/lambdas/broadcaster"
  output_path = "${path.module}/broadcaster.zip"
}

resource "aws_lambda_function" "broadcaster" {
  filename         = data.archive_file.broadcaster_zip.output_path
  function_name    = "${var.project_name}-broadcaster"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  source_code_hash = data.archive_file.broadcaster_zip.output_base64sha256

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      TABLE_NAME    = aws_dynamodb_table.connections.name
      WEBSOCKET_URL = "${aws_apigatewayv2_api.websocket_api.api_endpoint}/prod"
    }
  }
}

# --- 12. v2.0 'Storage Worker' Lambda ---
data "archive_file" "storage_worker_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/lambdas/storage-worker"
  output_path = "${path.module}/storage_worker.zip"
}

resource "aws_lambda_function" "storage_worker" {
  filename         = data.archive_file.storage_worker_zip.output_path
  function_name    = "${var.project_name}-storage-worker"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs18.x"
  memory_size      = 256
  timeout          = 30
  source_code_hash = data.archive_file.storage_worker_zip.output_base64sha256

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      DATABASE_URL = var.database_url
    }
  }
}

resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = aws_sqs_queue.storage_buffer.arn
  function_name    = aws_lambda_function.storage_worker.arn
  batch_size       = 1
}

# --- CloudWatch Alarms & Alerts ---
resource "aws_sns_topic" "lambda_alerts" {
  name = "${var.project_name}-lambda-alerts"
}

resource "aws_sns_topic_subscription" "lambda_alerts_email" {
  topic_arn = aws_sns_topic.lambda_alerts.arn
  protocol  = "email"
  endpoint  = var.admin_email
}

resource "aws_cloudwatch_metric_alarm" "match_api_errors" {
  alarm_name          = "${var.project_name}-match-api-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors Lambda errors for the Match API"
  alarm_actions       = [aws_sns_topic.lambda_alerts.arn]

  dimensions = {
    FunctionName = aws_lambda_function.match_api.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "score_update_errors" {
  alarm_name          = "${var.project_name}-score-update-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors Lambda errors for the Score Update function"
  alarm_actions       = [aws_sns_topic.lambda_alerts.arn]

  dimensions = {
    FunctionName = aws_lambda_function.score_update.function_name
  }
}
