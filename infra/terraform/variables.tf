variable "aws_region" {
  type        = string
  description = "The AWS region to deploy resources"
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "The deployment environment (dev or prod)"
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

variable "api_gateway_account_owner_project_name" {
  type        = string
  description = "Project name that owns the shared API Gateway account logging role."
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
  default     = "admin@example.com"
}

variable "llm_api_key" {
  type        = string
  description = "The API key for the LLM provider (OpenRouter, Groq, etc.)"
  sensitive   = true
}

variable "llm_base_url" {
  type        = string
  description = "Base URL for OpenAI-compatible LLM endpoint"
  default     = "https://api.openai.com/v1"
}

variable "openai_api_key" {
  type        = string
  description = "The OpenAI API key for native OpenAI models"
  default     = ""
  sensitive   = true
}

variable "llm_model" {
  type        = string
  description = "The LLM Model name (e.g. gpt-4o-mini)"
  default     = "gpt-4o-mini"
}


variable "google_client_id" {
  type        = string
  description = "Google OAuth Client ID for Cognito Federation"
  default     = "dummy-client-id" # Placeholder
}

variable "google_client_secret" {
  type        = string
  description = "Google OAuth Client Secret for Cognito Federation"
  default     = "dummy-client-secret" # Placeholder
}

variable "ml_model_version" {
  type        = string
  description = "Semantic version tag of the ML win predictor model stored in S3 and ECR (e.g. v2.2.0)"
  default     = "v2.2.0"
}

variable "github_token" {
  type        = string
  description = "GitHub Personal Access Token for the MCP GitHub Issue Agent in chat-api"
  default     = ""
  sensitive   = true
}

variable "github_repo" {
  type        = string
  description = "Target GitHub repository (owner/repo) for MCP issue creation"
  default     = "venkatesh-singamsetty/cricscore"
}
