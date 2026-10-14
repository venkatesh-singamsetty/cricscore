# 🎨 Frontend — React + TypeScript + Vite

The CricScore fan-facing and scorer-facing Single Page Application (SPA).

## Tech Stack

| Technology            | Purpose                            |
| --------------------- | ---------------------------------- |
| React 19              | UI component framework             |
| TypeScript            | Type-safe development              |
| Vite                  | Build tooling and local dev server |
| React Testing Library | Unit and component testing         |
| Vitest                | Fast unit test runner              |

## Local Development

```bash
cd apps/frontend
npm install
npm run dev       # Start Vite dev server at http://localhost:3000
```

## Environment Variables

For local development, create `apps/frontend/.env.local` (or another Vite-supported
environment file in `apps/frontend/`):

```env
VITE_API_URL=https://<api-gateway-id>.execute-api.<region>.amazonaws.com
VITE_WS_URL=wss://<ws-gateway-id>.execute-api.<region>.amazonaws.com/prod
```

> The local deploy script writes generated values to `apps/frontend/.env`. CI/CD
> supplies environment-specific values to the production build.

## Key Commands

| Command               | Description                            |
| --------------------- | -------------------------------------- |
| `npm run dev`         | Start local development server         |
| `npm run build`       | Build production bundle to `dist/`     |
| `npm run lint`        | TypeScript type-check (`tsc --noEmit`) |
| `npm run lint:eslint` | ESLint checks                          |
| `npm run test`        | Run Vitest unit tests                  |

## Deployment

The frontend is deployed to **AWS S3 + CloudFront** automatically:

1. `vite build` generates the production bundle in `dist/`
2. The CI/CD pipeline uploads `dist/` to the S3 bucket
3. CloudFront cache is invalidated so users see the new version immediately

## AI Chat Tab

The frontend includes a dedicated **AI Chat** interface that:

- Sends `POST /chat` requests to the `chat-api` Lambda
- Supports upload of tournament PDF rulebooks via `POST /rules/upload`
- Uses the configured OpenAI-compatible LLM provider via the `chat-api` Agentic RAG pipeline
