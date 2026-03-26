# 🚀 CricScore: Quick-Start Cloning Guide

Follow these 5 steps to deploy your own instance of **CricScore** on **Aiven** and **AWS**.

---

### 1. Provision Aiven Services (Free Tier)
Create the following services in your [Aiven Console](https://console.aiven.io/):
1. **Aiven for PostgreSQL**: Choose the Free plan. 
2. **Aiven for Apache Kafka**: Choose the Free plan.
   - Enabling **SASL** and **mTLS** in the service settings.

---

### 2. Configure the Security Vault (`certs/`)
CricScore uses Mutual TLS (mTLS) for Kafka security. 
1. Create a folder named `certs/` at the project root.
2. Download the following from your Aiven Kafka console and place them in the folder:
   - `ca.pem` (CA Certificate)
   - `cert.pem` (Access Certificate)
   - `key.pem` (Access Key)

---

### 3. Setup Infrastructure Variables (`terraform.tfvars`)
Create `terraform/terraform.tfvars` with your own service details:
```hcl
# AWS/Domain Settings
zone_domain      = "yourdomain.com"
domain_name      = "cricscore.yourdomain.com"
ses_source_email = "noreply@yourdomain.com"

# Aiven PostgreSQL
database_url     = "postgres://avnadmin:password@host:port/defaultdb?sslmode=require"

# Aiven Kafka
kafka_bootstrap_servers = "host:port"
kafka_username          = "avnadmin"
kafka_password          = "your-password"
```

---

### 4. Deploy Infrastructure (via `./deploy.sh`)
The project includes a root script that automates the whole build/deploy process including:
1. Building the Frontend
2. Injecting certificates into Lambda bundles
3. Provisioning AWS resources
4. Syncing files to S3 and CloudFront

```bash
# 1. Initialize Terraform (One-time)
cd terraform && terraform init && cd ..

# 2. Run the deployment script
./deploy.sh
```

---

### 4. AWS SES Preparation (Scorecard Emails)
CricScore uses **AWS Simple Email Service (SES)** to deliver match reports. Because SES operates in **Sandbox Mode** by default, you MUST:
- **Verify your Domain:** Add your domain (e.g., `example.com`) to SES and configure the DKIM records in Route 53.
- **Verify Recipient:** If you are in sandbox, only verified email addresses can receive reports.
- **Set Source:** Update `ses_source_email` in `terraform.tfvars` with a verified identity (e.g., `noreply@example.com`).

### 5. Final Frontend Sync (Post-Apply)
After your very first run, you will have received API Gateway URLs from the Terraform output. Update your root **`.env`** and run the script one final time to sync the configured frontend to S3:
   ```env
   VITE_API_URL=https://<id>.execute-api.us-east-1.amazonaws.com
   VITE_WS_URL=wss://<id>.execute-api.us-east-1.amazonaws.com/prod
   VITE_ADMIN_PIN=5678
   ```
   ```bash
   ./deploy.sh
   ```

---

### ✅ Success!
Your version of CricScore is now live! Visit your subdomain and start tracking matches in real-time.
