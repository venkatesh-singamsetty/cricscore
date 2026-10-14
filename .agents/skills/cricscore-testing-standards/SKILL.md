---
name: cricscore-testing-standards
description: Use when adding, changing, or selecting tests for CricScore frontend, backend, ML inference, AI chat, or deployed-site behavior.
---

# CricScore Testing Standards

## Test layers and commands

- Frontend and Node.js backend tests use Vitest. Run `npm test --prefix apps/frontend` and `npm test --prefix apps/backend`.
- Python ML inference tests use Pytest: `cd apps/ml-engine && python -m pytest test_predict.py`.
- Browser E2E tests use Playwright under `apps/e2e`. They exercise deployed environments in CI; inspect `apps/e2e/package.json` and `apps/e2e/playwright.config.ts` before assuming a local test is isolated or safe.
- The root `npm run test:all` also runs AI evaluation and may call a configured live API. Check its target and credentials before running it.

## Test quality

- Add focused regression tests for externally observable behavior and edge cases. For scoring, cover legal balls, extras, retirements, undo, persistence, and broadcast state as relevant.
- Mock external APIs and avoid mutating live Dev/Prod data in unit tests. E2E suites that target deployed systems require explicit environment and data-safety awareness.
- Run type checks and builds where the changed code path requires them; state which tests and validations actually ran.
