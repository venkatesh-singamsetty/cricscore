# 🎨 Frontend — React + TypeScript + Vite

The CricScore fan-facing and scorer-facing Single Page Application (SPA).

## Tech Stack

| Technology            | Purpose                            |
| --------------------- | ---------------------------------- |
| React 18              | UI component framework             |
| TypeScript            | Type-safe development              |
| Vite                  | Build tooling and local dev server |
| React Testing Library | Unit and component testing         |
| Vitest                | Fast unit test runner              |

## Local Development

```bash
cd apps/frontend
npm install
npm run dev       # Start Vite dev server at http://localhost:5173
```

## Environment Variables

Create a `.env.local` file in the **repo root** (not this directory):

```env
VITE_API_URL=https://<api-gateway-id>.execute-api.<region>.amazonaws.com
VITE_WS_URL=wss://<ws-gateway-id>.execute-api.<region>.amazonaws.com/prod
```

> These are auto-injected during deployment by `deploy_local_dev.sh` and the CI/CD pipeline.

## Key Commands

| Command         | Description                        |
| --------------- | ---------------------------------- |
| `npm run dev`   | Start local development server     |
| `npm run build` | Build production bundle to `dist/` |
| `npm run lint`  | TypeScript + ESLint checks         |
| `npm run test`  | Run Vitest unit tests              |

## Deployment

The frontend is deployed to **AWS S3 + CloudFront** automatically:

1. `vite build` generates the production bundle in `dist/`
2. The CI/CD pipeline uploads `dist/` to the S3 bucket
3. CloudFront cache is invalidated so users see the new version immediately

## AI Chat Tab

The frontend includes a dedicated **AI Chat** interface that:

- Sends `POST /chat` requests to the `chat-api` Lambda
- Supports upload of tournament PDF rulebooks via `POST /rules/upload`
- Streams AI replies from OpenRouter via the `chat-api` Agentic RAG pipeline
