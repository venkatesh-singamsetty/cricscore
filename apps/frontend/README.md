# 🎨 CricScore Frontend — React 19 + TypeScript + Vite SPA

Fan-facing, Scorer-facing, and Admin Single Page Application (SPA) served globally via **Amazon S3 + CloudFront (OAC)**.

---

## 🛠️ Technology Stack

| Layer                              | Package / Tool                               | Role                                                                                                             |
| :--------------------------------- | :------------------------------------------- | :--------------------------------------------------------------------------------------------------------------- |
| **UI&nbsp;Framework**              | React 19 + TypeScript                        | • Component architecture<br/>• Strict static typing                                                              |
| **Build&nbsp;&&nbsp;Dev**          | Vite + Tailwind CSS                          | • Fast HMR dev server (`localhost:3000` / `5173`)<br/>• Optimized production bundle                              |
| **Authentication**                 | `aws-amplify` + `@aws-amplify/ui-react`      | • Cognito Sign Up & Sign In<br/>• **Continue as Guest** flow<br/>• RS256 JWT session management                  |
| **Real&#8209;Time&nbsp;&&nbsp;AI** | Native `WebSocket` + REST `fetch`            | • Sub-second ball updates & live win-probability bar<br/>• AI chat & deterministic **Player of the Match** cards |
| **Unit&nbsp;Testing**              | Vitest + React Testing Library (`151` tests) | • Component & hook tests<br/>• DLS math & state synchronization verification                                     |

---

## ⚡ Commands Tutorial

| Action                                | Command (from `apps/frontend`) | Command (from Repo Root) |
| :------------------------------------ | :----------------------------- | :----------------------- |
| **Install dependencies**              | `npm install`                  | `npm install`            |
| **Start local dev server**            | `npm run dev`                  | `npm run dev`            |
| **Run 151 unit tests**                | `npm run test`                 | `npm run test`           |
| **TypeScript + ESLint check**         | `npm run lint`                 | `npm run lint`           |
| **Build production bundle (`dist/`)** | `npm run build`                | `npm run build`          |

```bash
cd apps/frontend
npm install
npm run dev
npm run test
npm run lint
npm run build
```

---

## ⚙️ Environment Variables (`apps/frontend/.env`)

Automatically populated by `./infra/scripts/deploy.sh --env dev --use-local-env` (or copied from `apps/frontend/.env.example` for local development):

| Variable                    | Example Value                                       | Purpose                         |
| :-------------------------- | :-------------------------------------------------- | :------------------------------ |
| `VITE_APP_TITLE`            | `CricScoreDev` / `CricScore`                        | Header badge & document title   |
| `VITE_API_URL`              | `https://api.cricscoredev.venkateshsingamsetty.com` | API Gateway HTTP REST endpoint  |
| `VITE_WS_URL`               | `wss://ws.cricscoredev.venkateshsingamsetty.com`    | API Gateway WebSocket endpoint  |
| `VITE_COGNITO_REGION`       | `us-east-1`                                         | AWS Cognito region              |
| `VITE_COGNITO_USER_POOL_ID` | `us-east-1_xxxxxxxxx`                               | Cognito User Pool ID            |
| `VITE_COGNITO_CLIENT_ID`    | `<app-client-id>`                                   | Cognito App Client ID           |
| `VITE_COGNITO_DOMAIN`       | `cricscoredev-auth-dev`                             | Cognito Hosted UI domain prefix |

See **[Local Frontend Quickstart](../../docs/local_frontend_quickstart.md)** for full details.
