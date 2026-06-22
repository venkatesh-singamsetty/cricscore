# 🗄️ Aiven Managed PostgreSQL Setup

CricScore uses Aiven PostgreSQL for its primary database. Follow these steps to provision and configure your database.

---

## 🤔 Why Aiven PostgreSQL?

We chose Aiven because it perfectly aligns with CricScore's **Zero-Cost Architecture** while delivering enterprise-grade data integrity:

- **Forever Free Tier**: Aiven provides a robust, fully managed PostgreSQL instance completely for free, ensuring zero monthly hosting costs.
- **ACID Compliance**: Crucial for tracking exact ball-by-ball cricket scoring events without race conditions or data loss.
- **Zero Maintenance**: Eliminates the need to manually manage database servers, backups, or security patching.
- **Automated Keep-Alive**: Aiven Free Tier pauses databases if they receive zero connections for 3 days. To prevent this, the repo includes a GitHub Action (`.github/workflows/keepalive.yml`) that automatically pings the database daily, guaranteeing it stays awake forever without manual intervention.

---

## 🛠️ Step-by-Step Creation Guide

1. **Sign Up / Log In**:
   Go to [console.aiven.io](https://console.aiven.io/) and create an account or log in.

2. **Create a New Service**:
   - Click **Create service**.
   - Select **PostgreSQL** as the service type.
   - Select your preferred Cloud Provider (e.g., AWS) and Region (e.g., `us-east-1` to match your Lambdas).
   - Select the **Free Plan** (or a paid plan if you require high availability/SLAs).
   - Enter a name for your service (e.g., `cricscore-pg`) and click **Create service**.

3. **Capture the Connection URI**:
   - Once the service is running (this takes a few minutes), navigate to the **Overview** tab.
   - Locate the **Service URI** in the Connection Information section. It will look something like this:
     `postgres://avnadmin:[PASSWORD]@[HOST]:[PORT]/defaultdb?sslmode=require`

4. **Configure Local Environment**:
   - Copy the full Service URI.
   - Open your `.env.local` file at the root of the `cricscore` repository.
   - Paste the URI as the value for `TF_DATABASE_URL`:
     ```bash
     TF_DATABASE_URL='postgres://avnadmin:[PASSWORD]@[HOST]:[PORT]/defaultdb?sslmode=require'
     ```

5. **Deploy**:
   - The database is now ready to use! When you run `./infra/scripts/deploy.sh`, Terraform will automatically deploy the tables and configure the AWS Lambda functions to securely communicate with this database.

---

© 2026 CricScore Documentation. 🏎️🏁🚀
