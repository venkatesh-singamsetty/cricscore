# AWS Infrastructure Settings
aws_region   = "us-east-1"
project_name = "cricscore"

# Domain Configuration
zone_domain      = "venkateshsingamsetty.site"
domain_name      = "cricscore.venkateshsingamsetty.site"
subdomain_prefix = "cricscore"

# Terraform Backend Settings
backend_bucket         = "venky-2026-terraform-state"
backend_dynamodb_table = "terraform-state-locking"
backend_key            = "cricscore/terraform.tfstate"
