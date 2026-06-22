# --- 7. IAM Role for Lambda Functions ---
resource "aws_iam_role" "lambda_role" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Add policy for DynamoDB access
resource "aws_iam_policy" "lambda_dynamo" {
  name        = "${var.project_name}-lambda-dynamo"
  description = "Allows Lambda to manage connections in DynamoDB"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action   = ["dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:GetItem", "dynamodb:Scan"]
        Effect   = "Allow"
        Resource = aws_dynamodb_table.connections.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_dynamo_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_dynamo.arn
}

# Add policy for SNS & SQS access (v2.0)
resource "aws_iam_policy" "lambda_messaging" {
  name        = "${var.project_name}-lambda-messaging"
  description = "Allows Lambda to use SNS & SQS for Fan-Out"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action   = ["sns:Publish", "sns:Subscribe"]
        Effect   = "Allow"
        Resource = aws_sns_topic.match_events.arn
      },
      {
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:SendMessage"
        ]
        Effect   = "Allow"
        Resource = aws_sqs_queue.storage_buffer.arn
      },
      {
        Action = [
          "kms:GenerateDataKey*",
          "kms:Decrypt",
          "kms:Encrypt"
        ]
        Effect   = "Allow"
        Resource = aws_kms_key.cric_key.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_messaging_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_messaging.arn
}

# IAM Policy for WebSocket Broadcasting
resource "aws_iam_policy" "lambda_websocket" {
  name        = "${var.project_name}-lambda-websocket"
  description = "Allow Lambda to post to WebSocket connections"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "execute-api:ManageConnections"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:execute-api:${var.aws_region}:*:*/*/*/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_websocket_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_websocket.arn
}

# --- IAM Policy for SES Email Dispatch ---
resource "aws_iam_policy" "lambda_ses" {
  name        = "${var.project_name}-lambda-ses"
  description = "Allow Lambda to send emails via AWS SES"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_ses_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_ses.arn
}

# --- IAM Policy for X-Ray Distributed Tracing ---
resource "aws_iam_role_policy_attachment" "lambda_xray_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess"
}
