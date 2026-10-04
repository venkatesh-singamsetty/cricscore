---
name: cricscore-testing-standards
description: Standards for unit, integration, and E2E testing across the diverse CricScore stack.
---

# CricScore Testing Standards

## 1. Frontend & Backend Node.js Tests

- We use **Vitest** for all TypeScript/JavaScript testing across both the React frontend and the Node.js Serverless Backend.
- Do not use Jest.
- Run tests via `npm run test` in the respective `apps/frontend` or `apps/backend` directories.

## 2. Machine Learning Tests

- We use **Pytest** for testing the Python ML engine.
- ML tests must cover both the inference handler (`predict.py`) and edge cases (e.g., negative runs, impossible scores).
- Run tests via `pytest apps/ml-engine/test_predict.py`.

## 3. End-to-End (E2E) UI Tests

- We use **Playwright** for browser-based UI automation tests.
- E2E tests are located in `apps/e2e`.
- Run locally via `npx playwright test`.
