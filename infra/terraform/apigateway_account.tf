// API Gateway account settings are regional singletons shared by dev and prod.
// Production owns the canonical role; other environments look it up.
data "aws_iam_role" "account_owner_cloudwatch" {
  count = var.project_name == var.api_gateway_account_owner_project_name ? 0 : 1
  name  = "${var.api_gateway_account_owner_project_name}-apigw-cloudwatch-role"
}

resource "aws_iam_role" "apigateway_cloudwatch_role" {
  name = "${var.project_name}-apigw-cloudwatch-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "apigateway.amazonaws.com" },
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "apigateway_cloudwatch_policy" {
  role = aws_iam_role.apigateway_cloudwatch_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ],
        Resource = "*"
      }
    ]
  })
}

resource "aws_api_gateway_account" "apigateway_account" {
  cloudwatch_role_arn = var.project_name == var.api_gateway_account_owner_project_name ? aws_iam_role.apigateway_cloudwatch_role.arn : data.aws_iam_role.account_owner_cloudwatch[0].arn
}
