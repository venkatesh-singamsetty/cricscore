# 🗄️ Aiven Managed PostgreSQL Setup

CricScore uses Aiven PostgreSQL for its primary database. Follow these steps to provision and configure your database.

---

## 🤔 Why Aiven PostgreSQL?

We chose Aiven for its managed PostgreSQL service and operational features. Available plans and pricing can change; confirm current terms in the Aiven console:

- **Plan options**: Select an available plan that fits your workload and budget.
- **ACID Compliance**: Crucial for tracking exact ball-by-ball cricket scoring events without race conditions or data loss.
- **Zero Maintenance**: Eliminates the need to manually manage database servers, backups, or security patching.
- **Keep-alive workflow**: The repository includes `.github/workflows/keepalive.yml`, which attempts a database query daily. This does not guarantee continuous availability; scheduled workflows, credentials, connectivity, and the selected Aiven plan can affect the result.

---

## 🛠️ Step-by-Step Creation Guide

1. **Sign Up / Log In**:
   Go to [console.aiven.io](https://console.aiven.io/) and create an account or log in.

2. **Create a New Service**:
   - Click **Create service**.
   - Select **PostgreSQL** as the service type.
   - Select your preferred Cloud Provider (e.g., AWS) and Region (e.g., `us-east-1` to match your Lambdas).
   - Select an available plan appropriate for your availability and cost requirements.
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
   - **Environment Isolation Note**: The Lambda functions use the environment-specific `DB_SCHEMA` (`dev` or `prod`). If both environments use the same database instance, these schemas separate their application data; configure the connection string separately for each environment as needed.

5. **Deploy**:
   - The database is ready to configure. The local deploy script applies Terraform and configures Lambda connectivity, but does not run database migrations. Run the required migrations separately; see the [deployment guide](./deployment.md).

---

© 2026 CricScore Documentation. 🏎️🏁🚀
