# --- 11. v2.0 'Fan-Out' Messaging Infrastructure ---

# SNS Topic: The Event Hub
resource "aws_sns_topic" "match_events" {
  name = "${var.project_name}-match-events"
}

# SQS Queue: The Reliability Buffer
resource "aws_sqs_queue" "storage_buffer" {
  name                      = "${var.project_name}-storage-buffer"
  message_retention_seconds = 86400 # 1 day
  receive_wait_time_seconds = 20    # Long polling
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

# SNS Sub 2: SQS Buffer Subscription
resource "aws_sns_topic_subscription" "sqs_sub" {
  topic_arn = aws_sns_topic.match_events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.storage_buffer.arn
}

resource "aws_sqs_queue_policy" "allow_sns" {
  queue_url = aws_sqs_queue.storage_buffer.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = "*"
      Action    = "sqs:SendMessage"
      Resource  = aws_sqs_queue.storage_buffer.arn
      Condition = {
        ArnEquals = { "aws:SourceArn" = aws_sns_topic.match_events.arn }
      }
    }]
  })
}
