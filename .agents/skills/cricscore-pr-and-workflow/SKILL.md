---
name: cricscore-pr-and-workflow
description: Use when preparing a CricScore branch or pull request, selecting local validation, changing CI/release workflows, or updating developer commands.
---

# CricScore PR and Workflow Standards

## Branch and pull request

- Do not push directly to `main`. Follow the repository's existing branch naming and remote workflow; do not force-push or rewrite shared history without authorization.
- Before opening or updating a PR, check the branch, worktree, target branch, and remote state. Fetch or rebase only when needed; do not merge or pull `main` into an in-progress branch blindly.
- Describe the change, user-visible behavior, risks, validation performed, and deployment/migration notes in the PR. Do not claim checks passed unless they ran and passed.
- Do not push, merge, or deploy unless the user requested that action. Never bypass required checks or branch protection.

## Validation and workflow changes

- The main local validation entry point is `./infra/scripts/validate_local.sh`; use `--skip-e2e` only when intentionally omitting the live Playwright suite. This script can skip optional scanners when their tools are missing, so report what actually ran.
- Choose focused tests for the changed area, then run the broader validation required by the task. CI is defined in `.github/workflows/ci.yml`; production deployment is in `.github/workflows/cd.yml`.
- Pull requests run validation. The CI workflow deploys Dev only from `main` or manual dispatch; the CD workflow deploys Prod for version tags or manual dispatch. Verify current workflow conditions before describing release behavior.
- If you change a package script, infrastructure/deployment command, or commonly used developer workflow, update the relevant `CHEATSHEET.md` section and test that the documented command and path exist.

Keep skill references in `README.md`, `.cursorrules`, and `.github/copilot-instructions.md` accurate when the skill catalog or always-on guidance changes. Do not claim a host automatically loads `.agents/skills/` unless that host's current configuration supports it.
