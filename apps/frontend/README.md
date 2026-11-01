# 🎨 CricScore Frontend — React 19 + TypeScript + Vite SPA

Fan-facing, Scorer-facing, and Admin Single Page Application (SPA) served globally via **Amazon S3 + CloudFront (OAC)**.

---

## 🛠️ Technology Stack

- **UI Framework (`React 19` + `TypeScript`):** Component architecture with strict static typing.
- **Build & Styling (`Vite` + `Tailwind CSS`):** Fast HMR dev server (`localhost:3000` / `5173`) and optimized production bundle.
- **Authentication (`aws-amplify` + `@aws-amplify/ui-react`):** Cognito Sign Up, Sign In, **Continue as Guest** flow, and RS256 JWT session management.
- **Real-Time & AI (`WebSocket` + `fetch`):** Sub-second ball updates, live win-probability bar, AI chat, and deterministic **Player of the Match** cards.
- **Unit Testing (`Vitest` + `React Testing Library`):** **151** component and hook tests covering DLS math, retired hurt/out badges, and live state synchronization.

---

## ⚡ Commands Tutorial

| Action                        | Command         |
| :---------------------------- | :-------------- |
| **Install dependencies**      | `npm install`   |
| **Start local dev server**    | `npm run dev`   |
| **Run 151 unit tests**        | `npm run test`  |
| **TypeScript + ESLint check** | `npm run lint`  |
| **Build production (`dist`)** | `npm run build` |

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

- **`VITE_APP_TITLE`:** Header badge & document title (`CricScoreDev` / `CricScore`).
- **`VITE_API_URL`:** API Gateway HTTP REST endpoint (`https://api.cricscoredev.venkateshsingamsetty.com`).
- **`VITE_WS_URL`:** API Gateway WebSocket endpoint (`wss://ws.cricscoredev.venkateshsingamsetty.com`).
- **`VITE_COGNITO_REGION`:** AWS Cognito region (`us-east-1`).
- **`VITE_COGNITO_USER_POOL_ID`:** Cognito User Pool ID (`us-east-1_xxxxxxxxx`).
- **`VITE_COGNITO_CLIENT_ID`:** Cognito App Client ID (`<app-client-id>`).
- **`VITE_COGNITO_DOMAIN`:** Cognito Hosted UI domain prefix (`cricscoredev-auth-dev`).

See **[Local Frontend Quickstart](../../docs/local_frontend_quickstart.md)** for full details.
