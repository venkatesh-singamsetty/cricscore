---
name: cricscore-cheatsheet-maintenance
description: Standards and requirements for maintaining the CHEATSHEET.md to ensure all developer workflow commands remain accurate and exhaustive.
---

# CricScore Cheatsheet Maintenance Standards

The `CHEATSHEET.md` is the primary entry point for developers onboarding to the project and acts as the source of truth for the end-to-end developer lifecycle.

## 📝 Core Rules

1. **Always Keep It Updated**: Whenever you introduce a new bash script, CLI tool, Node.js package command (like `npm run something`), GitHub Action workflow trigger, AWS CLI command, or database debugging query, you **MUST** update `CHEATSHEET.md`.
2. **Chronological Ordering**: Ensure the cheatsheet maintains its chronological developer lifecycle flow (Setup -> Branching -> Development -> Testing -> MLOps -> Security -> Deploy -> Troubleshooting). Do not place commands randomly.
3. **Be Descriptive**: Always add a `# comment` describing exactly what the command does before providing the bash execution string. Do not just paste bare commands.
4. **Use Exact Paths**: If a command requires a specific directory (like `terraform -chdir=infra/terraform`), explicitly provide that context rather than assuming the developer is already in the right directory.
5. **Pre-commit verification**: If you modify the `package.json` scripts or `infra/scripts/`, it is your responsibility to review the `CHEATSHEET.md` in the same PR to ensure documentation matches code.
