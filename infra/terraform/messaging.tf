# --- 11. v2.0 'Fan-Out' Messaging Infrastructure ---

# SNS Topic: The Event Hub (Standard for Lambda)
resource "aws_sns_topic" "match_events" {
  name              = "${var.project_name}-match-events"
  kms_master_key_id = aws_kms_key.cric_key.arn
}

# SQS Queue: The Reliability Buffer (FIFO for strict DB ordering)
resource "aws_sqs_queue" "storage_buffer" {
  name                        = "${var.project_name}-storage-buffer.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = 86400 # 1 day
  receive_wait_time_seconds   = 20    # Long polling
  kms_master_key_id           = aws_kms_key.cric_key.arn
}

# SNS Sub 1: Broadcaster (Fast-Path)
resource "aws_sns_topic_subscription" "broadcaster_sub" {
  topic_arn = aws_sns_topic.match_events.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.broadcaster.arn
}

resource "aws_lambda_permission" "sns_broadcaster" {
  statement_id  = "AllowExecutionFromSNS"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.broadcaster.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.match_events.arn
}
