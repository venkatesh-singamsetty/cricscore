# CricScore: Quickstart (Frontend Only)

If you are an interviewer or a developer who just wants to evaluate the CricScore frontend and its functionality **without** going through the complex AWS Terraform and database setup, this guide is for you.

By following these steps, you will run the React frontend locally on your laptop, but it will seamlessly connect to the **live, cloud-hosted DEV backend** (AWS API Gateway, Lambda, Cognito, and Aiven PostgreSQL).

## 🚀 3-Minute Setup

### 1. Clone the Repository

```bash
git clone https://github.com/venkatesh-singamsetty/cricscore.git
cd cricscore/apps/frontend
```

### 2. Configure Environment Variables

In the `apps/frontend/` directory, create a `.env` file. We will configure it to point to the live Development environment.

Create `.env` and paste the following values:

```env
# Point to the live AWS API Gateway and WebSockets
VITE_API_URL=https://api.cricscoredev.venkateshsingamsetty.com
VITE_WS_URL=wss://ws.cricscoredev.venkateshsingamsetty.com

# Connect to the live AWS Cognito User Pool for Authentication
VITE_COGNITO_USER_POOL_ID=us-east-1_InxzxljX7
VITE_COGNITO_CLIENT_ID=1n4m9rm96nhkd1vnqpnfsr1eg9
VITE_COGNITO_DOMAIN=cricscoredev-auth-dev
VITE_COGNITO_REGION=us-east-1

# Standard App Config
VITE_APP_TITLE=CricScore (Local against Cloud Backend)
VITE_ADMIN_PIN=1234 # Replace with the actual DEV pin if you need admin access
```

### 3. Install Dependencies

Make sure you have Node.js 20+ installed.

```bash
npm install
```

### 4. Start the Application

```bash
npm run dev
```

That's it!

The application will start at `http://localhost:5173`.

- **Authentication**: You can sign up for a new account. The confirmation emails will be handled by the live AWS Cognito service.
- **Match Scoring**: If you view a match, your local frontend will receive live updates via AWS API Gateway WebSockets from the cloud backend.
- **AI Chat**: You can test the AI RAG capabilities; your local frontend will send requests to the live `chat-api` Lambda function.

---

## ❓ Why does this work?

CricScore is designed with a strict **Serverless Microservices** architecture. Because the frontend (React/Vite) is completely decoupled from the backend (AWS API Gateway / Lambda), the frontend doesn't care whether it is hosted on S3/CloudFront or running on your local `localhost:5173`. As long as the `VITE_API_URL` environment variables are pointing to valid backend endpoints, the app will function identically to production.
