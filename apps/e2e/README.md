# 🧪 E2E — Playwright Integration Tests

End-to-end integration tests that run against the **live Dev environment** as the final gate before production deployment.

## Test Categories

| Test File              | Category     | What it validates                                   |
| ---------------------- | ------------ | --------------------------------------------------- |
| `smoke.spec.ts`        | Smoke        | Homepage loads, title is correct, key UI renders    |
| `api.spec.ts`          | API Contract | `/health`, `/matches`, CORS preflight responses     |
| `user-journey.spec.ts` | Full Journey | Complete match creation → scoring → completion flow |

## Running Tests

```bash
cd apps/e2e
npm install
npx playwright install chromium   # Only needed first time

# Run against live Dev environment (default)
npx playwright test

# Run against a specific URL
BASE_URL=https://cricscoredev.venkateshsingamsetty.site npx playwright test

# Run against local dev server (requires npm run dev in frontend)
BASE_URL=http://localhost:5173 npx playwright test
```

## Environment Variables

| Variable   | Default                       | Description                      |
| ---------- | ----------------------------- | -------------------------------- |
| `BASE_URL` | `https://cricscoredev...site` | The frontend URL to test against |
| `API_URL`  | From CI outputs               | The API Gateway base URL         |

## CI/CD Integration

E2E tests run automatically in the **`deploy_and_test_dev`** GitHub Actions job:

1. Dev infrastructure is deployed via Terraform
2. Playwright tests run against the freshly deployed Dev environment
3. If tests pass → `deploy_and_test_prod` job is triggered
4. If tests fail → production deployment is blocked

## Generating Reports

```bash
npx playwright test --reporter=html
npx playwright show-report
```

Reports are uploaded as GitHub Actions artifacts on every run.
