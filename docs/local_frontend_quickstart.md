# CricScore: Quickstart (Frontend Only)

If you are an interviewer or a developer who just wants to evaluate the CricScore frontend and its functionality **without** going through the complex AWS Terraform and database setup, this guide is for you.

By following these steps, you will run the React frontend locally on your laptop, but it will seamlessly connect to the **live, cloud-hosted DEV backend** (AWS API Gateway, Lambda, Cognito, and Aiven PostgreSQL).

## 🚀 5-Minute Setup (Copy & Paste)

Ensure you have **Node.js 20+** installed.
<details>
<summary><b>Don't have Node.js installed? Click here</b></summary>
<br/>
You can install it instantly via terminal:
<code>curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && nvm install 20</code>
Or download the official installer from <a href="https://nodejs.org/">nodejs.org</a>.
</details>

Then, open your terminal and paste this entire block:

```bash
# 1. Clone & enter the repository
git clone https://github.com/venkatesh-singamsetty/cricscore.git
cd cricscore

# 2. Install monorepo dependencies
npm install

# 3. Configure frontend to point to the live AWS Cloud
cd apps/frontend
cat << 'EOF' > .env
VITE_API_URL=https://api.cricscoredev.venkateshsingamsetty.com
VITE_WS_URL=wss://ws.cricscoredev.venkateshsingamsetty.com
VITE_COGNITO_USER_POOL_ID=us-east-1_InxzxljX7
VITE_COGNITO_CLIENT_ID=1n4m9rm96nhkd1vnqpnfsr1eg9
VITE_COGNITO_DOMAIN=cricscoredev-auth-dev
VITE_COGNITO_REGION=us-east-1
VITE_APP_TITLE=CricScore (Local against Cloud Backend)
VITE_ADMIN_PIN=1234
EOF

# 4. Start the application
npm run dev
```

That's literally it!

The application will start at `http://localhost:3000`.

- **Authentication**: You can sign up for a new account. The confirmation emails will be handled by the live AWS Cognito service.
- **Match Scoring**: If you view a match, your local frontend will receive live updates via AWS API Gateway WebSockets from the cloud backend.
- **AI Chat**: You can test the AI RAG capabilities; your local frontend will send requests to the live `chat-api` Lambda function.

---

## ❓ Why does this work?

CricScore is designed with a strict **Serverless Microservices** architecture. Because the frontend (React/Vite) is completely decoupled from the backend (AWS API Gateway / Lambda), the frontend doesn't care whether it is hosted on S3/CloudFront or running on your local `localhost:3000`. As long as the `VITE_API_URL` environment variables are pointing to valid backend endpoints, the app will function identically to production.

## 🔒 Security Note: The VITE_ADMIN_PIN Backdoor

You may notice the `VITE_ADMIN_PIN` in the configuration. If you type `/login 1234` inside the AI Chat window, the frontend UI will instantly grant you "admin" buttons (such as the ability to delete matches or update scores) without needing to create a full AWS Cognito account.

However, this is purely a **frontend visual toggle**. If a guest tries to actually click "Delete Match" or attempts to ask the LLM to delete a match, the operation will **fail**:

1. **API Gateway Blocking**: Real destructive actions like `DELETE /matches` require a valid AWS Cognito JWT token. Without one, AWS API Gateway will block the request with a `401 Unauthorized` before it ever reaches the database.
2. **LLM Sandboxing**: Even if the guest tells the AI Agent to delete a match, the AI's PostgreSQL connection (via the `execute_sql` MCP tool) is strictly hardcoded to use `BEGIN READ ONLY;`. The database itself will reject any `DELETE` or `UPDATE` commands attempted by the AI!
