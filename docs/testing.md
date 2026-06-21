# Testing Guide for CricScore

This project uses a comprehensive testing strategy combining **Vitest** for backend unit testing and **Playwright** for End-to-End (E2E) browser and API integration testing.

---

## Testing During Local Development

When you are actively making code changes, use these commands to instantly test your work:

### 1. The "Run Everything" Command
If you want to run all the fast unit tests across the entire project at once (this runs automatically before a `git push`), stay in the root of your project and run:
```bash
npm run test:all
```

### 2. Testing While You Code (Watch Mode)
If you are actively making changes to files and want the tests to re-run automatically every time you hit "save":

**For Frontend changes:**
```bash
cd frontend
npm run test
```
*(Press `q` to quit watch mode when you're done).*

**For Backend changes:**
```bash
cd backend
npm run test:watch
```

### 3. Testing the Live App in a Real Browser
If you want to verify that the entire app works properly in a real browser instance:
```bash
cd e2e
npx playwright test --ui
```
*This opens a time-travel UI where you can literally see Playwright clicking through your application step-by-step!*

---

## 1. Backend Unit Tests (Vitest)

The backend uses `vitest` to run extremely fast unit tests for AWS Lambda functions. We use class prototype stubbing and spies via `vi.spyOn()` to mock AWS SDK calls and database interactions, ensuring tests do not hit real infrastructure.

### Running Backend Tests

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies (if you haven't already):
   ```bash
   npm install
   ```
3. Run the test suite:
   ```bash
   npm test
   ```
4. Run tests in watch mode (for active development):
   ```bash
   npm run test:watch
   ```
5. Generate coverage report:
   ```bash
   npm run test:coverage
   ```

---

## 2. End-to-End Tests (Playwright)

The `e2e/` folder contains Playwright scripts that test the entire system as a real user would. This includes:
- **Smoke Tests**: Verifies that the frontend loads, rendering key UI elements and modals.
- **API Integration Tests**: Verifies that the backend API responds correctly to valid requests and handles CORS preflight correctly.

### Running E2E Tests

1. Navigate to the E2E directory:
   ```bash
   cd e2e
   ```
2. Install Playwright and its dependencies (first time only):
   ```bash
   npm install
   npx playwright install --with-deps
   ```
3. Run the tests in headless mode:
   ```bash
   npx playwright test
   ```
4. View the HTML test report:
   ```bash
   npx playwright show-report
   ```
5. Run tests in UI mode (interactive debugging):
   ```bash
   npx playwright test --ui
   ```

### Overriding the Target Environment

By default, Playwright targets the live production environment. If you want to test against a local deployment or a staging environment, use the `BASE_URL` environment variable:

```bash
BASE_URL=http://localhost:5173 npx playwright test
```

---

## 3. Continuous Integration (CI)

Our GitHub Actions pipelines automatically enforce testing on all pushes and pull requests to the `main` branch.

- **Backend CI**: `.github/workflows/backend-infra.yml` runs `vitest` unit tests on the `backend/` folder before any Terraform infrastructure is applied.
- **E2E CI**: `.github/workflows/e2e.yml` provisions a fresh Chrome instance and runs the entire Playwright test suite against production to detect regressions. Test reports are available as build artifacts for 14 days.
