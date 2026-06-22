# 🌩️ Infrastructure: Terraform Registry

This folder contains the Infrastructure as Code (IaC) required to provision and maintain the CricScore real-time match engine on **AWS** and **Aiven**.

---

## 🛠️ Main Components (`main.tf`)

### 1. **Compute Layer**

- **Lambda Functions**: `match_api`, `score_update`, `broadcaster`.
- **IAM Roles**: Least-privilege roles for all compute units.

### 2. **State & Database**

- **DynamoDB**: `cricscore-connections` (User session tracking).
- **PostgreSQL**: Aiven Service integration (via `database_url`).

### 3. **Routing Gateway**

- **HTTP API Gateway**: `/match`, `/update-score`.
- **WebSocket API Gateway**: `$connect`, `$disconnect`.
- **CloudFront**: Distribution for S3 Static Website.

---

## 🚀 Deployment Guide

### 1. **Setup Credentials**

Create a **`terraform.tfvars`** file (Git Ignored) in this folder:

```hcl
aws_region             = "us-east-1"
project_name           = "cricscore"
domain_name            = "yourdomain.com"
database_url           = "postgres://..."
```

### 2. **Apply Infrastructure**

```bash
terraform init
terraform plan
terraform apply -auto-approve
```

---

## 🛡️ Security Handlers

- **IAM Policies**: Policies for DynamoDB Scan/Put and API Gateway Push are attached to the common Lambda role.
