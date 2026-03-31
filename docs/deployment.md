# 🚀 Deployment: Aiven & AWS Infrastructure

## 🏗️ Phase 0: Local Lifecycle Preview
Test the **v1.5.2** frontend engine locally against the production cloud backend.

### **Prerequisites**
- **Node.js**: Version **18.x or higher**.
- **npm**: Included with Node.js.
- **Git**: To clone the repository.

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/venkatesh-singamsetty/cric-score.git
    cd cric-score && npm install
    ```
2.  **Initialize Environment**:
    ```bash
    cp .env.example .env
    npm run dev
    ```

---

## 🛡️ Critical: Bootstrap Foundations
Managed **outside** the main app logic to prevent deletion during `terraform destroy`. 

1.  **S3 State Bucket**: `venky-2026-terraform-state` (tfstate storage).
2.  **DynamoDB Lock Table**: `terraform-state-locking` (locking engine).
3.  **Route 53 Master Zone**: Global domain identity (e.g., `venkateshsingamsetty.site`).

🔍 **Governance**: See **[`docs/bootstrap_infra.md`](./bootstrap_infra.md)** for character-perfect blueprints.

---

## 🌩️ Full-Stack Managed Infrastructure

### 1. Provision Aiven (Managed Services)
1. **Aiven PostgreSQL**: Master system of record (Set SSL Mode to `require`).
2. **Aiven Kafka**: Event streaming backbone (Enable **mTLS** in console).

### 2. Configure Security Vault (`certs/`)
CricScore uses mTLS for Kafka security. Download `ca.pem`, `cert.pem`, and `key.pem` from Aiven Kafka and place them in a root `/certs` folder.

### 3. Deploy Serverless Backend (Terraform)
1.  **Initialize**: `cd terraform && terraform init`
2.  **Apply Logic**: `./deploy.sh` (Automates Lambda builds, S3 syncing, and CloudFront invalidation).

© 2026 CricScore Documentation. 🏎️🏁🚀
