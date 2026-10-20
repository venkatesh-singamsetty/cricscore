# Testing Strategy for CricScore

This repository's tests range from isolated unit tests to integration and deployed-environment checks. The sections below describe what the current test scripts and workflows actually run.

---

## 🚀 Quick Start: Running Local Tests

The root script runs the frontend and backend test suites, followed by the HTTP-based chat evaluation. It does not run the Playwright E2E suite.

Run this command from the **root** of the repository:

```bash
npm run test:all
```

The chat evaluation requires a reachable chat API. Set `CHAT_API_URL` to the API base URL; without it, the runner defaults to `http://localhost:3000`.

```bash
CHAT_API_URL=https://api.example.com npm run test:all
```

---

## 1. Unit Tests

Unit tests are isolated tests that verify individual functions, utilities, or background cloud logic without spinning up external dependencies.

- **Frontend Unit Tests**: Validate React Types, state handlers, live WebSocket score merge utilities, Duckworth-Lewis-Stern (DLS) Par Score calculations (1–50 overs), scorer access guards, localStorage safety, and summary formatting.
  - _Location:_ `apps/frontend/src/test/types.test.ts`, `apps/frontend/src/test/dlsUtils.test.ts`, `apps/frontend/src/test/applyLiveScoreToMatches.test.ts`, `apps/frontend/src/test/scorerAccess.test.ts`, `apps/frontend/src/test/storageSafety.test.ts`, `apps/frontend/src/test/summaryFormat.test.ts`, `apps/frontend/src/test/authConfig.test.ts`
- **ML Engine Unit Tests (PyTest)**: Validate format-agnostic ball-by-ball dynamic-programming win probability (`win_probability.py`), DLS resource parity alignment on achievable chases, 10-to-20 over T20 model blending, and decided/impossible chase overrides in Python.
  - _Location:_ `apps/ml-engine/test_predict.py`
- **Backend Event-Driven Unit Tests**: Validate AWS Lambda workers (e.g., `storage-worker`, `broadcaster`, `score-update`, `chat-api` handlers and MCP tools) using `aws-sdk-client-mock` and Vitest mocks.
  - _Location:_ `apps/backend/lambdas/storage-worker/index.test.js`, `apps/backend/lambdas/broadcaster/index.test.js`, `apps/backend/lambdas/score-update/index.test.js`, `apps/backend/lambdas/onconnect/index.test.js`, `apps/backend/lambdas/ondisconnect/index.test.js`, `apps/backend/lambdas/chat-api/handlers/*.test.js`, `apps/backend/lambdas/chat-api/mcp/tools/tools.test.js`

### Running Unit Tests

- **Frontend:** `npm run test --prefix apps/frontend` (Note: This executes both Unit and Integration tests).
- **Backend:** `npm run test --prefix apps/backend` (Use `npm run test:watch --prefix apps/backend` for active development).
- **ML Engine:** `./apps/ml-engine/venv/bin/pytest apps/ml-engine/test_predict.py`

---

## 2. Integration Tests

Integration tests verify that different components and services work together correctly, simulating interactions without rendering in a real browser.

- **Frontend Component Integration**: We use **React Testing Library** to mount React components in a virtual DOM, simulate user clicks, input typing, WebSocket messages, and verify that the components properly validate state transitions and payloads before firing network calls.
  - _Location:_ `apps/frontend/src/test/MatchList.test.tsx`, `apps/frontend/src/test/MatchSetup.test.tsx`, `apps/frontend/src/test/MatchView.test.tsx`, `apps/frontend/src/test/LiveScoreboard.test.tsx`, `apps/frontend/src/test/AiMatchPrediction.test.tsx`, `apps/frontend/src/test/ChatComponent.test.tsx`

### Running Integration Tests

Since these share the same Vitest runner as Frontend Unit Tests, running the command below will execute both Unit and Integration tests together:

```bash
npm run test --prefix apps/frontend
```

---

## 3. API Tests

Backend handler tests validate selected route behavior using API Gateway-style events and mocked dependencies; deployed HTTP API behavior is covered separately by Playwright request tests.

- **REST Handler Tests**: Backend tests call the Lambda handler with API Gateway-style events and mock database interactions. They check selected routes and response codes; they do not send requests through a deployed API Gateway.
  - _Location:_ `apps/backend/lambdas/match-api/index.test.js`
- **Auth & Authorization Tests**: Per-endpoint authorization is validated:
  - `DELETE /match/{id}` by the match owner → 200
  - `DELETE /match/{id}` by an unauthorized user → 403
  - `DELETE /match/{id}` by an Admin group member (not owner) → 200 (**admin override**)
  - `POST /match` without a valid JWT email claim → 401
  - `DELETE /matches` (bulk purge) by a non-admin → 403
  - `GET /admin/users` by a non-admin → 403 with `"Admins only"` error message

> [!NOTE]
> See [auth.md](./auth.md) for the complete authentication and authorization model documentation.

### Running API Tests

Since these share the same Vitest runner as Backend Unit Tests, they are executed together:

```bash
npm run test --prefix apps/backend
```

---

## 4. Smoke Tests

Smoke tests use Playwright to check that the app at the configured base URL loads and that the create-match form can be opened when its button is visible.

- **Homepage and Match Setup Checks**: Checks the page title and, when the create-match button is visible, opens the form and checks for team-name inputs. The modal check is skipped if the button is not visible.
  - _Location:_ `apps/e2e/tests/smoke.spec.ts`
- **AI API Checks**: Sends requests to `/chat` and `/chat/summary` and checks expected responses for missing fields and a non-existent match ID.
  - _Location:_ `apps/e2e/tests/ai-api.spec.ts`

### Running Smoke Tests

Run the smoke checks via Playwright inside the `e2e/` folder:

```bash
cd apps/e2e
npx playwright test tests/smoke.spec.ts
```

---

## 5. End-to-End (E2E) User Journey Tests

E2E tests sit at the very top of the testing pyramid. They utilize **Playwright** to spin up an actual browser instance, navigate to the application, and simulate a real human being performing complex, multi-step actions.

- **Critical User Journey**: Automates a two-over match using the guest scorer flow—creating a match, selecting squads, winning a toss, recording scoring and wicket events, completing both innings, and checking the result.
  - _Location:_ `apps/e2e/tests/user-journey.spec.ts`

### Running E2E Tests

Because E2E tests require specific browser binaries, you must run them directly from the `e2e` folder.

1. Navigate to the E2E directory:
   ```bash
   cd apps/e2e
   ```
2. Install dependencies (First time only):
   ```bash
   npm install
   npx playwright install --with-deps
   ```
3. Run all configured Playwright tests (smoke, HTTP API, AI API, and user journey) in headless mode:
   ```bash
   npx playwright test
   ```
4. Run **only** the E2E User Journey test:
   ```bash
   npx playwright test tests/user-journey.spec.ts
   ```
5. Run tests in UI mode (Interactive visual debugger):
   ```bash
   npx playwright test --ui
   ```

> [!WARNING]
> By default, `npx playwright test` uses `http://localhost:3000`. Set `BASE_URL` when targeting a deployed environment, and be aware that journey tests can create or modify test data:
>
> ```bash
> BASE_URL=http://localhost:3000 npx playwright test
> ```

---

## 6. AI Chat Evaluation

The root `npm run test:ai` script runs `evals/run_ai_chat_eval.js` against the API URL passed with `--url` or `CHAT_API_URL` (default: `http://localhost:3000`). The runner sends prompts from `evals/ai-chat-eval.json` to `/chat` and records HTTP status, latency, and a reply preview in `evals/latest-ai-chat-eval-results.json`.

The current pass/fail check is based on HTTP success. Although evaluation cases include an `expected_tool` field, the runner does not assert tool selection, answer grounding, or safety quality; those need separate review or additional evaluators.

---

## 7. Availability & Reliability Testing

The repository includes selected reliability tests, but does not provide a comprehensive high-concurrency or infrastructure-failure test suite.

- **Queue failure handling**: The current Terraform configures a FIFO SQS persistence queue with a one-day message-retention period, but does not configure a dead-letter queue or redrive policy. DLQ recovery is therefore not part of the current automated tests.
- **Multi-AZ Resilience**: This repository does not include an automated multi-AZ failover test. Availability and recovery depend on the AWS services and deployment configuration.

---

## 8. Environment Testing Strategy (Dev and Production)

When operating with multiple environments, consider the impact of test data, especially in production:

### 🔬 Development Environment

The CI workflow deploys to and runs Playwright tests against the development environment on `main` (and on manual dispatch). These tests may create test data in that environment.

- **Full E2E Playwright Suite**: Executes the complete User Journey, creates matches, and interacts with the database.
- **OWASP ZAP (DAST)**: Runs a baseline scan against the deployed development site URL. The configured ZAP action does not fail the workflow on findings.

### 🌐 Direct Production Environment

The production deployment workflow runs AI evaluation and Playwright tests against the production API and site, followed by a ZAP baseline scan. Playwright tests should be reviewed for their production data impact.

- **Database keep-alive**: `keepalive.yml` runs a database query daily; it is not an application uptime monitor and does not ping the `/health` endpoint.
- **Passive Observability**: Using AWS CloudWatch Logs and Sentry to monitor real-user traffic for unexpected crashes.

---

## Continuous Integration (CI)

GitHub Actions run validation on pull requests to `main`; deployment, AI evaluation, and deployed-site Playwright tests run in the development or production workflow.

- **Development**: `.github/workflows/ci.yml` validates changes on pull requests and deploys/tests Dev on `main` or manual dispatch.
- **Production**: `.github/workflows/cd.yml` deploys on a version tag or manual dispatch, then runs AI evaluation, Playwright tests, and a ZAP baseline scan.

## Python AI service (`apps/ai-service`)

Unit tests (router, tools, LangGraph flows, handler, tracing) use in-memory fakes; no DB, LLM or network.

```bash
cd apps/ai-service && .venv/bin/pytest -q
```

Chat read-only guarantees are covered in `apps/backend/lambdas/chat-api/handlers/chatHandler.test.js` and `mcp/tools/tools.test.js` (`npm --prefix apps/backend test`).
