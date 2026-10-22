# CricScore Project Guidance

- **Mandatory Rules & Skills**: Always read `.agents/AGENTS.md` and load the relevant skill under `.agents/skills/*/SKILL.md` before changing code, infrastructure, tests, or opening a PR.
- **Git & PR Workflow**: Never push directly to `main`. Always run `git fetch origin main && git merge origin/main` and `./infra/scripts/validate_local.sh` before pushing or opening/updating a PR. After pushing, check `gh pr checks` and CodeQL review comments.
- **Tests & Documentation**: Every code change must include regression tests (`apps/frontend/src/test/`, `apps/backend/lambdas/`, `apps/ml-engine/test_predict.py`, `apps/e2e/`) and documentation updates (`docs/testing.md`, tutorials; `changelog.md` is managed by semantic-release on `main`).
- **Cost & Security**: Never create paid AWS resources (NAT Gateways, KMS CMKs, CloudWatch Dashboards, Secrets Manager, DynamoDB Provisioned Capacity). Never expose `.env.local` or credentials.
