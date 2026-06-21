resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-mission-control"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiName", "${var.project_name}-api"],
            ["AWS/ApiGateway", "Count", "ApiName", "${var.project_name}-websocket-api"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "API Gateway Traffic (Requests)"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Lambda", "Errors", "FunctionName", "${var.project_name}-match-api"],
            ["AWS/Lambda", "Errors", "FunctionName", "${var.project_name}-score-upd"],
            ["AWS/Lambda", "Errors", "FunctionName", "${var.project_name}-broadcaster"],
            ["AWS/Lambda", "Errors", "FunctionName", "${var.project_name}-storage-worker"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Error Rates"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", "${var.project_name}-match-api"],
            ["AWS/Lambda", "Invocations", "FunctionName", "${var.project_name}-score-upd"],
            ["AWS/Lambda", "Invocations", "FunctionName", "${var.project_name}-broadcaster"],
            ["AWS/Lambda", "Invocations", "FunctionName", "${var.project_name}-storage-worker"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Lambda Invocations"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/SQS", "ApproximateNumberOfMessagesVisible", "QueueName", "${var.project_name}-storage-buffer"],
            ["AWS/SQS", "ApproximateNumberOfMessagesDelayed", "QueueName", "${var.project_name}-storage-buffer"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "SQS Storage Buffer Depth"
          period  = 300
        }
      }
    ]
  })
}
