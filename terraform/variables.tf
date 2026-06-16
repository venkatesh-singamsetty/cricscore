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

variable "ses_source_email" {
  type        = string
  description = "The email address to use as the SES source for sending emails."
}

variable "database_url" {
  type        = string
  description = "Aiven PostgreSQL Connection URI"
  sensitive   = true
}



variable "admin_email" {
  type        = string
  description = "The admin email address to receive BCC match reports."
  default     = "venky.2k57@gmail.com"
}
