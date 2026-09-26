variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "state_bucket_name" {
  description = "Name of the S3 bucket to store Terraform state (must be globally unique)"
  type        = string
  default     = "yourname-cricscore-terraform-state"
}

variable "dynamodb_table_name" {
  description = "Name of the DynamoDB table for Terraform state locking"
  type        = string
  default     = "terraform-state-locking"
}

variable "domain_name" {
  description = "The root domain name (e.g., example.com) to create a Route 53 hosted zone for"
  type        = string
  default     = "example.com"
}
