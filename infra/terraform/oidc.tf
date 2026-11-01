// ==============================================================================
// GitHub Actions OIDC (OpenID Connect) Identity Provider & IAM Role
// ==============================================================================
// Enables passwordless, keyless authentication from GitHub Actions runners into AWS STS.
// Controlled by var.enable_github_oidc (default: false to prevent duplicate provider conflicts
// across dev and prod environments in the same account). Can be toggled on in environments/prod.tfvars.

variable "enable_github_oidc" {
  description = "Whether to manage GitHub Actions OIDC provider and IAM deployment role in this Terraform state."
  type        = bool
  default     = false
}

variable "github_repository" {
  description = "The target GitHub repository allowed to assume the deployment role (owner/repo)."
  type        = string
  default     = "venkatesh-singamsetty/cricscore"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  count           = var.enable_github_oidc ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1", "1c5876bd52c07b75d732bed3138e21a6cbe3f2f1"]
}

resource "aws_iam_role" "github_actions" {
  count = var.enable_github_oidc ? 1 : 0
  name  = "cricscore-github-actions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github_actions[0].arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repository}:*"
        }
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "github_actions_admin" {
  count      = var.enable_github_oidc ? 1 : 0
  role       = aws_iam_role.github_actions[0].name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
}

output "github_actions_role_arn" {
  description = "ARN of the IAM role assumed by GitHub Actions via OIDC"
  value       = var.enable_github_oidc ? aws_iam_role.github_actions[0].arn : null
}
