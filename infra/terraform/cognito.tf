# --- Cognito User Pool Setup ---
resource "aws_cognito_user_pool" "pool" {
  name = "${var.project_name}-user-pool"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}



resource "aws_cognito_user_pool_client" "client" {
  name         = "${var.project_name}-client"
  user_pool_id = aws_cognito_user_pool.pool.id

  generate_secret = false
  
  supported_identity_providers = ["COGNITO"]

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code", "implicit"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  
  callback_urls = ["http://localhost:5173/", "https://${var.domain_name}/"]
  logout_urls   = ["http://localhost:5173/", "https://${var.domain_name}/"]

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]
}

resource "aws_cognito_user_group" "admin" {
  name         = "Admin"
  user_pool_id = aws_cognito_user_pool.pool.id
  description  = "Administrators with full access"
}

resource "aws_cognito_user_pool_domain" "domain" {
  domain       = "${var.project_name}-auth-${var.environment}"
  user_pool_id = aws_cognito_user_pool.pool.id
}
