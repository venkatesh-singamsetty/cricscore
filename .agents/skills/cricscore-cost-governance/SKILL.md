---
name: cricscore-cost-governance
description: Use when proposing or reviewing AWS resource, scaling, observability, storage, network, or deployment changes that may affect CricScore operating costs.
---

# CricScore Cost Governance

Check current Terraform, [cost management guidance](../../../docs/cost_management.md), and current AWS pricing before estimating costs. Free-tier eligibility and prices vary by account, region, and time.

## Review checklist

- Estimate recurring charges, request/compute charges, data transfer, storage growth, and per-resource multipliers for realistic and peak traffic.
- The project currently avoids NAT gateways and paid custom CloudWatch dashboards. Do not add them without an explicit cost/architecture review; never recommend assigning public IPs to Lambda functions as a NAT substitute.
- Prefer the existing serverless and managed-service patterns where they meet the requirement. Do not sacrifice security, availability, or data durability solely to claim free-tier operation.
- Treat AWS Budgets as notifications, not spending caps. Verify the configured budget and alert scope rather than promising a maximum bill.
- Use the encryption approach required by the service and threat model. Compare AWS-managed and customer-managed key costs; do not weaken a security requirement to avoid a small recurring charge.

Describe assumptions and likely cost drivers with every material infrastructure proposal. Do not treat mutable image tags, service free tiers, or low expected traffic as guarantees of low cost.
