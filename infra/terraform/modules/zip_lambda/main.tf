resource "aws_lambda_function" "this" {
  function_name    = var.function_name
  role             = var.role_arn
  filename         = var.filename
  source_code_hash = var.source_code_hash
  handler          = var.handler
  runtime          = var.runtime
  timeout          = var.timeout
  memory_size      = var.memory_size

  tracing_config {
    mode = "Active"
  }

  dynamic "environment" {
    for_each = var.environment_variables == null ? [] : [var.environment_variables]

    content {
      variables = environment.value
    }
  }

  tags = var.tags
}