# 📦 Terraform Module: `zip_lambda`

Reusable Terraform module (`infra/terraform/modules/zip_lambda`) that provisions a Node.js 24.x ZIP-packaged AWS Lambda function with **AWS X-Ray Active Tracing** and a **7-day CloudWatch Log Group retention policy**.

---

## 📋 Provisioned Resources & Defaults

| Resource / Setting              | Value / Default                                       | Purpose                                                                              |
| :------------------------------ | :---------------------------------------------------- | :----------------------------------------------------------------------------------- |
| `aws_lambda_function.this`      | `runtime = "nodejs24.x"`, `tracing_config = "Active"` | Executes handler with AWS X-Ray distributed tracing                                  |
| `aws_cloudwatch_log_group.this` | `retention_in_days = 7`                               | Prevents indefinite CloudWatch log storage accumulation (`~$1/month` cost guardrail) |
| `memory_size` / `timeout`       | Default `128 MB` / `3s` (overridable)                 | Right-sized per workload (`score-upd`: `256 MB`, `chat-api`: `1024 MB`)              |

---

## 💻 Usage Example (`infra/terraform/lambda.tf`)

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
