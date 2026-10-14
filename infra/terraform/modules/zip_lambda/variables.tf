variable "function_name" {
  description = "Name assigned to the Lambda function."
  type        = string
}

variable "role_arn" {
  description = "Execution role ARN for the Lambda function."
  type        = string
}

variable "filename" {
  description = "Path to the packaged ZIP deployment artifact."
  type        = string
}

variable "source_code_hash" {
  description = "Base64-encoded hash used to detect deployment package changes."
  type        = string
}

variable "handler" {
  description = "Lambda handler entry point."
  type        = string
  default     = "index.handler"
}

variable "runtime" {
  description = "AWS Lambda runtime identifier."
  type        = string
  default     = "nodejs24.x"
}

variable "timeout" {
  description = "Maximum execution time in seconds."
  type        = number
  default     = 3

  validation {
    condition     = var.timeout >= 1 && var.timeout <= 900
    error_message = "Lambda timeout must be between 1 and 900 seconds."
  }
}

variable "memory_size" {
  description = "Memory allocation in MB."
  type        = number
  default     = 128

  validation {
    condition     = var.memory_size >= 128 && var.memory_size <= 10240
    error_message = "Lambda memory must be between 128 and 10240 MB."
  }
}

variable "environment_variables" {
  description = "Environment variables passed to the function; null omits the environment block."
  type        = map(string)
  default     = null
}

variable "tags" {
  description = "Resource tags. Provider default tags are inherited automatically."
  type        = map(string)
  default     = null
}