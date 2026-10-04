# --- 8. Match API Lambda Function ---
data "archive_file" "match_api_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../apps/backend/lambdas/match-api"
  output_path = "${path.module}/match_api.zip"
}

resource "aws_lambda_function" "match_api" {
  filename         = data.archive_file.match_api_zip.output_path
  function_name    = "${var.project_name}-match-api"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  source_code_hash = data.archive_file.match_api_zip.output_base64sha256
  timeout          = 30

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      DATABASE_URL         = var.database_url
      DB_SCHEMA            = var.environment
      SES_SOURCE           = var.ses_source_email
      ADMIN_REPORT_EMAIL   = var.admin_email
      BROADCASTER_LAMBDA   = aws_lambda_function.score_update.function_name
      FRONTEND_URL         = "https://${var.domain_name}"
      BACKUP_BUCKET        = aws_s3_bucket.match_backups.bucket
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.pool.id
    }
  }

  tags = {
    Project = var.project_name
  }
}

# --- 10. Score Update Lambda ---
data "archive_file" "score_update_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../apps/backend/lambdas/score-update"
  output_path = "${path.module}/score_update.zip"
}

resource "aws_lambda_function" "score_update" {
  filename         = data.archive_file.score_update_zip.output_path
  function_name    = "${var.project_name}-score-upd"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  memory_size      = 256
  source_code_hash = data.archive_file.score_update_zip.output_base64sha256
  timeout          = 30

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      MATCH_EVENTS_TOPIC   = aws_sns_topic.match_events.arn
      STORAGE_BUFFER_QUEUE = aws_sqs_queue.storage_buffer.url
      DATABASE_URL         = var.database_url
      DB_SCHEMA            = var.environment
      ADMIN_REPORT_EMAIL   = var.admin_email
    }
  }

  tags = {
    Project = var.project_name
  }
}

# --- onConnect Lambda ---
data "archive_file" "onconnect_zip" {
  type        = "zip"
  source_file = "${path.module}/../../apps/backend/lambdas/onconnect/index.js"
  output_path = "${path.module}/onconnect.zip"
}

resource "aws_lambda_function" "onconnect" {
  filename         = data.archive_file.onconnect_zip.output_path
  function_name    = "${var.project_name}-onconnect"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
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
  source_file = "${path.module}/../../apps/backend/lambdas/ondisconnect/index.js"
  output_path = "${path.module}/ondisconnect.zip"
}

resource "aws_lambda_function" "ondisconnect" {
  filename         = data.archive_file.ondisconnect_zip.output_path
  function_name    = "${var.project_name}-ondisconnect"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
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
  source_dir  = "${path.module}/../../apps/backend/lambdas/broadcaster"
  output_path = "${path.module}/broadcaster.zip"
}

resource "aws_lambda_function" "broadcaster" {
  filename         = data.archive_file.broadcaster_zip.output_path
  function_name    = "${var.project_name}-broadcaster"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
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
  source_dir  = "${path.module}/../../apps/backend/lambdas/storage-worker"
  output_path = "${path.module}/storage_worker.zip"
}

resource "aws_lambda_function" "storage_worker" {
  filename         = data.archive_file.storage_worker_zip.output_path
  function_name    = "${var.project_name}-storage-worker"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  memory_size      = 256
  timeout          = 30
  source_code_hash = data.archive_file.storage_worker_zip.output_base64sha256

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      DATABASE_URL = var.database_url
      DB_SCHEMA    = var.environment
    }
  }
}

resource "aws_lambda_event_source_mapping" "sqs_trigger" {
  event_source_arn = aws_sqs_queue.storage_buffer.arn
  function_name    = aws_lambda_function.storage_worker.arn
  batch_size       = 1
}

# --- CloudWatch Alarms & Alerts ---
# trivy:ignore:AWS-0095 (Topic encryption requires CMK which costs $1/mo, skipped)
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

# --- Chat API Lambda Function ---
data "archive_file" "chat_api_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../apps/backend/lambdas/chat-api"
  output_path = "${path.module}/chat_api.zip"
}

resource "aws_lambda_function" "chat_api" {
  filename         = data.archive_file.chat_api_zip.output_path
  function_name    = "${var.project_name}-chat-api"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  source_code_hash = data.archive_file.chat_api_zip.output_base64sha256
  timeout          = 30
  memory_size      = 1024

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      DATABASE_URL         = var.database_url
      DB_SCHEMA            = var.environment
      LLM_API_KEY          = var.llm_api_key
      OPENAI_API_KEY       = var.openai_api_key != "" ? var.openai_api_key : var.llm_api_key
      LLM_BASE_URL         = var.llm_base_url
      LLM_MODEL            = var.llm_model
      COGNITO_USER_POOL_ID = aws_cognito_user_pool.pool.id
    }
  }

  tags = {
    Project = var.project_name
  }
}

# --- Cognito PreSignUp Lambda ---
data "archive_file" "cognito_presignup_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../apps/backend/lambdas/cognito-presignup"
  output_path = "${path.module}/cognito_presignup.zip"
}

resource "aws_lambda_function" "cognito_presignup" {
  filename         = data.archive_file.cognito_presignup_zip.output_path
  function_name    = "${var.project_name}-cognito-presignup"
  role             = aws_iam_role.lambda_role.arn
  handler          = "index.handler"
  runtime          = "nodejs24.x"
  source_code_hash = data.archive_file.cognito_presignup_zip.output_base64sha256

  tracing_config {
    mode = "Active"
  }

  tags = {
    Project = var.project_name
  }
}

# --- ML Predictor Lambda (Python via Docker ECR) ---

resource "aws_ecr_repository" "ml_predict" {
  # checkov:skip=CKV_AWS_163: "Image scanning not required for this demo project"
  # checkov:skip=CKV_AWS_136: "AES256 default encryption is sufficient, no custom KMS keys to avoid costs"
  # checkov:skip=CKV_AWS_51: "Image tags must be mutable for CI/CD latest tag reuse"
  name                 = "${var.project_name}-ml-predict"
  image_tag_mutability = "MUTABLE"
  force_delete         = true
}

resource "null_resource" "docker_build_push" {
  triggers = {
    # Rebuild when any file in ml-engine changes
    dir_sha1 = sha1(join("", [for f in fileset("${path.module}/../../apps/ml-engine", "*") : filesha1("${path.module}/../../apps/ml-engine/${f}")]))
  }

  provisioner "local-exec" {
    command = <<EOF
      aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin ${aws_ecr_repository.ml_predict.repository_url}
      docker build --platform linux/amd64 --provenance=false -t ${aws_ecr_repository.ml_predict.repository_url}:latest ${path.module}/../../apps/ml-engine
      docker push ${aws_ecr_repository.ml_predict.repository_url}:latest
      aws lambda update-function-code --function-name ${var.project_name}-ml-predict --image-uri ${aws_ecr_repository.ml_predict.repository_url}:latest || true
    EOF
  }
}

resource "aws_lambda_function" "ml_predict" {
  function_name = "${var.project_name}-ml-predict"
  role          = aws_iam_role.lambda_role.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.ml_predict.repository_url}:latest"
  timeout       = 30
  memory_size   = 512

  tracing_config {
    mode = "Active"
  }

  tags = {
    Project = var.project_name
  }

  depends_on = [null_resource.docker_build_push]
}
