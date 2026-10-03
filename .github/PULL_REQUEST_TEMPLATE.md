## Description

<!-- Describe your changes in detail -->
<!-- What does this PR solve or implement? -->

## Type of Change

<!-- Check the appropriate box using [x] -->

- [ ] `feat:` New feature (triggers MINOR release)
- [ ] `fix:` Bug fix (triggers PATCH release)
- [ ] `docs:` Documentation only changes
- [ ] `chore:` Routine tasks, dependencies, or pipeline updates
- [ ] `refactor:` Code change that neither fixes a bug nor adds a feature

## Component Change Matrix

<!-- Briefly list what changed under the relevant components, or mark unchanged -->

| Component            | Status       | Changed Files / Details |
| -------------------- | ------------ | ----------------------- |
| 🎨 Frontend App      | ➖ Unchanged |                         |
| ⚡ Backend & Lambdas | ➖ Unchanged |                         |
| 🏗️ Terraform IaC     | ➖ Unchanged |                         |
| 📚 Documentation     | ➖ Unchanged |                         |
| ⚙️ CI/CD & Workflows | ➖ Unchanged |                         |

## Verification Checklist

- [ ] Code formatting and linters verified (`npm run lint`)
- [ ] Unit test suites executed (`npm run test:all`)
- [ ] E2E browser tests locally verified if UI changed (`npm run test:e2e`)
- [ ] Secret scanning verified (`gitleaks protect -v`)
- [ ] Terraform syntax verified (`terraform validate`)

## Screenshots / Evidence (if applicable)

<!-- Drag and drop screenshots here if this affects the UI -->

---

_Note: Please ensure your PR title follows Conventional Commits format (e.g., `feat: add awesome feature`) so Semantic Release can automatically generate the changelog!_
