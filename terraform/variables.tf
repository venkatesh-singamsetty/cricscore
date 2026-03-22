variable "aws_region" {
  type        = string
  description = "The AWS region to deploy resources"
  default     = "us-east-1"
}

variable "domain_name" {
  type        = string
  description = "The full subdomain name for the application (e.g. cricscore.example.com)"
}

variable "zone_domain" {
  type        = string
  description = "The root domain name for the existing Route53 Hosted Zone (e.g. example.com)"
}

variable "subdomain_prefix" {
  type        = string
  description = "The prefix for the subdomain (e.g. 'cricscore')"
  default     = "cricscore"
}

variable "project_name" {
  type        = string
  description = "Name of the project for naming resources"
  default     = "cricscore"
}

variable "backend_bucket" {
  type        = string
  description = "S3 bucket for terraform state"
}

variable "backend_key" {
  type        = string
  description = "Key for terraform state file"
  default     = "cricscore/terraform.tfstate"
}

variable "backend_dynamodb_table" {
  type        = string
  description = "DynamoDB table for state locking"
}
