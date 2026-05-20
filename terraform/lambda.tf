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

  environment {
    variables = {
      DATABASE_URL       = var.database_url
      SES_SOURCE         = var.ses_source_email
      ADMIN_REPORT_EMAIL = var.admin_email
      BROADCASTER_LAMBDA = aws_lambda_function.score_update.function_name
    }
  }

  tags = {
    Project = var.project_name
  }
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

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.connections.name
    }
  }
}

# --- Kafka Consumer Lambda ---
data "archive_file" "kafka_consumer_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend/lambdas/kafka-consumer"
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
      TABLE_NAME     = aws_dynamodb_table.connections.name
      WEBSOCKET_URL  = "${aws_apigatewayv2_api.websocket_api.api_endpoint}/prod"
      KAFKA_BROKERS  = var.kafka_bootstrap_servers
      KAFKA_USERNAME = var.kafka_username
      KAFKA_PASSWORD = var.kafka_password
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

  environment {
    variables = {
      DATABASE_URL   = var.database_url
      KAFKA_BROKERS  = var.kafka_bootstrap_servers
      KAFKA_USERNAME = var.kafka_username
      KAFKA_PASSWORD = var.kafka_password
    }
  }
}

resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = aws_sqs_queue.storage_buffer.arn
  function_name    = aws_lambda_function.storage_worker.arn
  batch_size       = 1
}
