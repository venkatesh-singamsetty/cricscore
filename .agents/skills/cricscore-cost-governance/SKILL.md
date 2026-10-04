---
name: cricscore-cost-governance
description: Guidelines for managing and optimizing AWS cloud infrastructure costs to ensure operations remain within the free tier.
---

# CricScore Cost Governance

This skill documents proven patterns to optimize cloud costs and manage serverless resources efficiently.

## 1. Cloud Cost Optimization & Free-Tier Guardrails

- **Forbidden Expensive AWS Resources (DO NOT CREATE)**:
  - **No NAT Gateways** (~$32/mo each): Place Lambdas in public subnets with public IP assignment or use API Gateway endpoints.
  - **No AWS KMS Customer Managed Keys** ($1/mo per key): Use AWS-managed default keys (`aws/ssm`, `aws/s3`).
  - **No CloudWatch Custom Dashboards** ($3/mo each): Rely on CloudWatch metric logs and free console views.

## 2. Serverless Efficiency

- **ECR Management**: For ML models deployed via Docker, push directly to the `:latest` tag and overwrite it rather than using unique version tags. This ensures the total storage size never exceeds the 500MB free-tier limit.
