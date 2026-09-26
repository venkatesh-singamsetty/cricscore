output "s3_state_bucket_name" {
  description = "The name of the S3 bucket storing Terraform state"
  value       = aws_s3_bucket.terraform_state.bucket
}

output "dynamodb_lock_table_name" {
  description = "The name of the DynamoDB table for Terraform state locking"
  value       = aws_dynamodb_table.terraform_locks.name
}

output "route53_zone_id" {
  description = "The Route 53 Hosted Zone ID"
  value       = aws_route53_zone.main.zone_id
}

output "route53_name_servers" {
  description = "The Name Servers for the Route 53 Hosted Zone. Add these to your domain registrar."
  value       = aws_route53_zone.main.name_servers
}
