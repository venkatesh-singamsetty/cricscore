# CricScore: Quickstart (Frontend Only)

This guide explains how to run the CricScore frontend locally against a CricScore backend you are authorized to use. It does not configure or connect to a shared live backend.

You need the API Gateway and WebSocket URLs, and Cognito configuration, from your own deployment or its administrator. Do not use another deployment's accounts or send test data to a backend without permission.

## Local setup

Ensure you have **Node.js 24+** installed.
<details>
<summary><b>Don't have Node.js installed? Click here</b></summary>
<br/>
You can install it instantly via terminal:
<code>curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && nvm install 24</code>
Or download the official installer from <a href="https://nodejs.org/">nodejs.org</a>.
</details>

Clone the repository and install its dependencies:

```bash
git clone https://github.com/venkatesh-singamsetty/cricscore.git
cd cricscore
npm install
```

Configure the frontend with values from your own deployment:

```bash
cp apps/frontend/.env.example apps/frontend/.env
```

Set `VITE_API_URL`, `VITE_WS_URL`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, and `VITE_COGNITO_DOMAIN` in `apps/frontend/.env` to the values for that deployment. Keep this file local; do not commit credentials or environment-specific configuration.

Start the frontend:

```bash
npm run dev --prefix apps/frontend
```

The app starts at `http://localhost:3000`. Authentication, scoring, and AI features depend on the configured backend and its authorization settings.

---

## ❓ Why does this work?

CricScore is designed with a strict **Serverless Microservices** architecture. Because the frontend (React/Vite) is completely decoupled from the backend (AWS API Gateway / Lambda), the frontend doesn't care whether it is hosted on S3/CloudFront or running on your local `localhost:3000`. As long as the `VITE_API_URL` environment variables are pointing to valid backend endpoints, the app will function identically to production.

## 🔐 Authentication and Admin Access

The frontend uses the configured AWS Cognito user pool for authentication. Admin actions require signing in with an account that belongs to the Cognito `Admin` group; there is no frontend PIN or chat command that grants administrator access.
