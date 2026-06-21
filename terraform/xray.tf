resource "aws_xray_sampling_rule" "cricscore_sampling" {
  rule_name      = "${var.project_name}-sampling-rule"
  priority       = 1
  version        = 1
  reservoir_size = 1    # Trace 1 request per second guaranteed
  fixed_rate     = 0.05 # Then trace 5% of all subsequent requests
  host           = "*"
  http_method    = "*"
  url_path       = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"

  tags = {
    Project = var.project_name
  }
}
