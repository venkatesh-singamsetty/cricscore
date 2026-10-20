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

## ⚡ Full Local Pre-Push Validation & Smart Hook Caching

Before pushing code, run the unified local validation script:

```bash
./infra/scripts/validate_local.sh --skip-e2e
```

This executes the entire local test battery in sequence:

1. **Frontend**: Lint (`tsc --noEmit`), unit & integration tests (`vitest`), high-severity npm audit, and Vite production build.
2. **Backend**: Unit tests (`vitest`) and npm audit across Lambdas.
3. **Python AI & ML**: Pytest suites for `apps/ai-service` and `apps/ml-engine`.
4. **Infrastructure**: Terraform format & validation, and platform dashboard generation.
5. **Security & SBOM**: Checkov IaC scanning, GitLeaks secrets detection, Trivy vulnerability scanning, and Syft SBOM generation.

### Zero-Waste Pre-Push Git Hook

To prevent duplicate test execution and wasted developer time, `validate_local.sh` records a cryptographically signed state receipt (`.git/.local_validation_receipt`) matching the current commit and working tree state.

- When `git push` runs, the `.husky/pre-push` hook verifies if the current tree state already passed validation.
- If already validated, the hook exits instantly (**< 0.1s**) with:
  `⚡ Local validation already passed for <commit>. Skipping duplicate tests!`
- If uncommitted changes exist or validation was not run, `pre-push` executes the validation automatically as a safety gate.
- To bypass manually if needed, push with `git push --no-verify` or set `SKIP_PRE_PUSH=1 git push`.

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

## Continuous Integration (CI) & Pull Request Verification

Every Pull Request opened or updated against `main` triggers four mandatory, blocking validation jobs in `.github/workflows/ci.yml` and CodeQL analysis in `.github/workflows/codeql.yml`:

| PR Gate / Job           | Suites Covered                                 | Exact Commands Run                                                                                        |
| ----------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **`validate_security`** | Secrets & IaC Security                         | `gitleaks detect`, `checkov -d infra/terraform/`                                                          |
| **`validate_frontend`** | Lint, Unit/Component Tests, Audit, Build       | `npm run lint` (`tsc --noEmit`), `vitest run` (75 tests), `trivy fs`, `npm run build`                     |
| **`validate_backend`**  | Lambda Unit Tests, Trivy, Terraform Validation | `npm test` (85 Lambda tests), `trivy fs`, `terraform fmt -check`, `terraform validate`                    |
| **`validate_python`**   | Python AI Service & ML Engine Tests, Pip Trivy | `pytest apps/ai-service -q` (57 tests), `pytest apps/ml-engine/test_predict.py -q` (24 tests), `trivy fs` |
| **`CodeQL Analysis`**   | Dual-language Static Security Analysis         | CodeQL AST queries across `javascript-typescript` and `python`                                            |

Pull requests must pass **all 5 gates** before merging. They do not deploy or interact with live cloud databases.

### Post-Merge Execution (DEV Deployment & Live Verification)

When merged to `main`, `ci.yml` automatically triggers `deploy_and_test_dev`:

1. Runs database migrations (`migrate.sh`).
2. Applies Terraform and updates Lambda containers in ECR.
3. Builds and syncs the frontend to S3 and invalidates CloudFront.
4. Executes live AI chat evaluation (`npm run test:ai`).
5. Executes the full **Playwright E2E Test Suite (14 tests)** against `https://cricscoredev.venkateshsingamsetty.com`.
6. Executes the **OWASP ZAP DAST** baseline vulnerability scan.

---

## Python AI service (`apps/ai-service`)

Unit tests (router, tools, LangGraph flows, handler, tracing) use in-memory fakes; no DB, LLM or network.

```bash
cd apps/ai-service && .venv/bin/pytest -q
```

Chat read-only guarantees are covered in `apps/backend/lambdas/chat-api/handlers/chatHandler.test.js` and `mcp/tools/tools.test.js` (`npm --prefix apps/backend test`).

MCP server tests (`apps/ai-service/tests/test_mcp.py`, `test_mcp_stdio.py`) cover the approved tool list, valid/invalid IDs, DB errors, unconfigured dependencies, and a real stdio client round-trip.

---

## Machine Learning & MLOps Tests (`apps/ml-engine`)

- **Inference Unit & Checksum Tests**:
  Covers 1-over, 5-over, 20-over formats, first-innings and chase probabilities, DLS par alignment, model SHA-256 verification, and simulation fallback:

  ```bash
  apps/ml-engine/venv/bin/pytest apps/ml-engine/test_predict.py -v
  ```

- **Candidate Model Comparison & Pipeline Verification**:
  Evaluates 8 candidate algorithms (Logistic Regression, GaussianNB, DecisionTree, LinearSVM, RandomForest, ExtraTrees, HistGradientBoosting, and promoted champion XGBoost), checks quality gates (Accuracy >= 0.60, ROC-AUC >= 0.65), logs MLflow metrics, and generates release manifests:

  ```bash
  python apps/ml-engine/compare_models.py v2.2.0
  # Or via reproducible DVC pipeline:
  dvc repro
  ```

- **Classical ML Regression & Clustering Benchmarks**:
  - 1st-innings total score regression: `python apps/ml-engine/projected_score_regression.py`
  - Pitch condition & scoring archetype clustering: `python apps/ml-engine/match_clustering.py`
  - Complete 14-model reference guide: [`docs/ml_models_handbook.md`](ml_models_handbook.md)
