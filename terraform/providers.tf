terraform {
  required_version = ">= 1.0.0"

  backend "s3" {
    bucket         = "venky-2026-terraform-state"
    key            = "cricscore/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-state-locking"
    encrypt        = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# CloudFront certificates MUST be deployed in us-east-1
provider "aws" {
  alias  = "us-east-1"
  region = "us-east-1"
}
