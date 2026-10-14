output "function_name" {
  description = "Deployed Lambda function name."
  value       = aws_lambda_function.this.function_name
}

output "arn" {
  description = "Deployed Lambda function ARN."
  value       = aws_lambda_function.this.arn
}

output "invoke_arn" {
  description = "Invocation ARN for service integrations."
  value       = aws_lambda_function.this.invoke_arn
}