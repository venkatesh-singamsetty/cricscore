---
name: cricscore-pr-and-workflow
description: PR guidelines and workflow scripts for maintaining code quality and validations locally.
---

# CricScore PR and Workflow Standards

## 1. Branching & PR Rules

- **Never push directly to `main`**.
- **Always pull latest changes**: Run `git pull origin main` before creating a new branch or pushing, to ensure the local repository is in sync with PR merges done via the GitHub UI.
- Always create a branch with standard prefix: `fix/`, `feat/`, `chore/`.

## 2. Local Validation Execution

Before opening a PR or pushing, run:
`./infra/scripts/pre-push-check.sh --skip-e2e`

## 3. Pull Request Creation

When local validations pass:
`git push origin <branch-name>`
`gh pr create --title "<type>: <short summary>" --body "<detailed description>"`

- **NEVER use the `--admin` flag** to force-merge a PR before remote GitHub Actions checks pass.
- Always use `gh pr merge --auto` to queue the merge, or manually check `gh pr checks` and wait for all status checks to report success before merging.

## 4. Release Automation Lifecycle

- Merging a PR into `main` automatically triggers `CricScore CI/CD` (DEV Deployment).
- Upon success, Semantic Release updates CHANGELOG and creates a release tag.
  - **Note:** Semantic Release requires `GITHUB_TOKEN` to push to `main` and bypass branch protection. The repository's Default Workflow Permissions must be set to "Read and write permissions" and "Allow GitHub Actions to create and approve pull requests" must be enabled.
- Creating a release tag triggers `Deploy PROD`.

## 5. AI Governance Updates

If you add or modify a skill module in the `.agents/skills/` directory, you MUST update the universal integration bridges:

1. **Antigravity**: Ensure the `SKILL.md` file exists in `.agents/skills/`.
2. **Cursor / Claude**: Update `.cursorrules` to list the new skill index.
3. **GitHub Copilot**: Update `.github/copilot-instructions.md` to reflect the newly governed domain.
