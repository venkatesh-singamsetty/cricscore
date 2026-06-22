# Enterprise Testing Strategy for CricScore

This repository follows a rigorous **Enterprise Standard Testing Pyramid**. Tests are structured from the fastest and most isolated to the most comprehensive and integrated.

---

## 🚀 Quick Start: Running Local Tests

We have provided a unified script in the root folder to run all fast Unit, Integration, and API tests at once.

Run this command from the **root** of the repository:

```bash
npm run test:all
```

_(This command automatically runs `npm run test --prefix apps/frontend` and `npm test --prefix apps/backend` sequentially.)_

---

## 1. Unit Tests

Unit tests are isolated tests that verify individual functions, utilities, or background cloud logic without spinning up external dependencies.

- **Frontend Unit Tests**: Validate React Types and state handlers.
  - _Location:_ `apps/frontend/src/test/types.test.ts`
- **Backend Event-Driven Unit Tests**: Validate AWS Lambda workers (e.g., `storage-worker`, `broadcaster`) using `aws-sdk-client-mock`.
  - _Location:_ `apps/backend/lambdas/storage-worker/index.test.js`, `apps/backend/lambdas/broadcaster/index.test.js`

### Running Unit Tests

- **Frontend:** `npm run test --prefix apps/frontend`
- **Backend:** `npm test --prefix apps/backend` (Use `npm run test:watch --prefix apps/backend` for active development).

---

## 2. Integration Tests

Integration tests verify that different components and services work together correctly, simulating interactions without rendering in a real browser.

- **Frontend Component Integration**: We use **React Testing Library** to mount React components in a virtual DOM, simulate user clicks, input typing, and verify that the components properly validate payloads before firing network calls.
  - _Location:_ `apps/frontend/src/test/MatchSetup.test.tsx`

### Running Integration Tests

Since these share the same Vitest runner as Frontend Unit Tests, they are executed together:

```bash
npm run test --prefix apps/frontend
```

---

## 3. API Tests

API tests explicitly validate the HTTP contract and REST endpoints of the backend architecture. They mock the database but execute the full API request lifecycle.

- **REST API Validation**: We test the API Gateway proxy paths (e.g., `/health`, `GET /matches`, `POST /match`) to guarantee proper status codes (200, 201, 404, 500) and data structures.
  - _Location:_ `apps/backend/lambdas/match-api/index.test.js`

### Running API Tests

Since these share the same Vitest runner as Backend Unit Tests, they are executed together:

```bash
npm test --prefix apps/backend
```

---

## 4. Smoke Tests

Smoke tests are the fastest End-to-End checks. They ping the live production application using a real Chromium browser just to verify that the app is online, the DNS is resolving, and critical UI shells are visible.

- **Live Availability Checks**: Validates that the Viewer Dashboard and Match Setup modes successfully render without crashing.
  - _Location:_ `apps/e2e/tests/smoke.spec.ts`

### Running Smoke Tests

Run these via Playwright inside the `e2e/` folder:

```bash
cd apps/e2e
npx playwright test tests/smoke.spec.ts
```

---

## 5. End-to-End (E2E) User Journey Tests

E2E tests sit at the very top of the testing pyramid. They utilize **Playwright** to spin up an actual browser instance, navigate to the application, and simulate a real human being performing complex, multi-step actions.

- **Critical User Journeys**: Automates the entire match lifecycle—navigating the UI, entering authentication credentials, creating a match, selecting squads, winning a toss, scoring an over on the live scoreboard, and gracefully ending the inning.
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
3. Run all E2E tests in headless mode (Invisible):
   ```bash
   npx playwright test
   ```
4. Run tests in UI mode (Interactive visual debugger):
   ```bash
   npx playwright test --ui
   ```

> [!WARNING]
> By default, `npx playwright test` targets the live production URL. Do not run this command locally unless you intend to create test records in your production database! To test against a local server, specify the `BASE_URL`:
>
> ```bash
> BASE_URL=http://localhost:5173 npx playwright test
> ```

---

## Continuous Integration (CI)

Our GitHub Actions pipelines automatically enforce this entire testing pyramid on all Pull Requests and merges to the `main` branch.

- **Frontend CI**: `.github/workflows/frontend.yml` automatically executes the frontend Unit and Integration tests.
- **Backend CI**: `.github/workflows/backend-infra.yml` automatically executes the backend Unit and API tests before any Terraform infrastructure is applied.
- **E2E CI**: `.github/workflows/e2e.yml` runs the complete Smoke and E2E User Journey test suite against the deployed environment to prevent production regressions.
