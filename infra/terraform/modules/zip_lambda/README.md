# ZIP Lambda Module

Creates a ZIP-packaged Lambda with active X-Ray tracing, configurable runtime,
memory, timeout, environment variables, and tags. The root module owns package
creation and service-specific IAM or event-source wiring.

```hcl
module "match_api" {
  source           = "./modules/zip_lambda"
  function_name    = "${var.project_name}-match-api"
  role_arn         = aws_iam_role.lambda_role.arn
  filename         = data.archive_file.match_api_zip.output_path
  source_code_hash = data.archive_file.match_api_zip.output_base64sha256
  timeout          = 30
  environment_variables = {
    DB_SCHEMA = var.environment
  }
}
```

The module inherits the root AWS provider, including default tags. Keep archive
resources, IAM policies, triggers, alarms, and integrations in the calling root
so cross-service dependencies remain visible.
