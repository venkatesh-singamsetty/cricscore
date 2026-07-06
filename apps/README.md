# 📦 Apps — Monorepo Applications

This directory contains all the application code for the CricScore platform, organized as a monorepo.

## Structure

```
apps/
├── frontend/     # React + TypeScript + Vite web application
├── backend/      # Node.js AWS Lambda functions
└── e2e/          # Playwright end-to-end integration tests
```

## Applications

### 🎨 `frontend/`

The React SPA served to fans and scorers via AWS CloudFront + S3.

- Built with **React 18**, **TypeScript**, and **Vite**
- Real-time score updates via WebSocket connection to API Gateway
- AI Chat tab powered by the `chat-api` Lambda

### ⚡ `backend/`

All server-side logic runs as serverless AWS Lambda functions.

- Each Lambda is a self-contained Node.js module
- Shared dependencies are installed per-Lambda (no layer approach)
- See [`backend/README.md`](./backend/README.md) for Lambda details

### 🧪 `e2e/`

Playwright tests run against the live Dev environment as part of the CI/CD pipeline.

- Tests cover smoke, API contract, and full user journey flows
- Runs automatically on every push to `main`
