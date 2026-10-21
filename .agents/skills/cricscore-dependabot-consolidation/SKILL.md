---
name: cricscore-dependabot-consolidation
description: Use when starting a new feature/fix branch or consolidating open Dependabot PRs into an active working branch, validating dependency updates, and safely closing superseded Dependabot PRs as an authorized collaborator.
---

# CricScore Dependabot PR Consolidation Standards

Whenever creating a new working branch (`feat/*`, `fix/*`, or `chore/deps-*`), check for open Pull Requests authored **strictly by Dependabot (`app/dependabot`)** and consolidate, validate, and merge them into the working branch so dependency updates are verified and shipped together without burning 5x duplicate CI/CD runs.

## 1. Strict Security & Collaborator Ownership Gate (Mandatory)

To prevent any external user or fork from merging Dependabot PRs into their own branch and closing repository PRs (which would cause CricScore to lose those dependency updates):

1. **Bot-Only Author Filter**:
   - **ONLY** select open PRs where `author.login == "app/dependabot"` and `author.is_bot == true`:
     ```bash
     gh pr list --repo venkatesh-singamsetty/cricscore --author "app/dependabot" --state open --json number,title,headRefName,author
     ```
   - **NEVER** auto-consolidate or auto-close PRs opened by human contributors or other accounts.
2. **Collaborator Permission Verification (`admin` | `maintain` | `write`)**:
   - Before pulling/consolidating with intent to close, verify the current authenticated GitHub user is an authorized collaborator on `venkatesh-singamsetty/cricscore`:
     ```bash
     LOGIN=$(gh api user --jq .login)
     PERM=$(gh api "repos/venkatesh-singamsetty/cricscore/collaborators/$LOGIN/permission" --jq .permission)
     ```
   - Require `$PERM` to be one of `admin`, `maintain`, or `write`. If `$PERM` is `read`, `none`, or fails, **ABORT IMMEDIATELY** and never close any Dependabot PRs.
3. **Canonical Remote & Push Verification Before Closing**:
   - Verify `git remote get-url origin` points to `venkatesh-singamsetty/cricscore` (or `cric-score`).
   - **Never close a Dependabot PR before its commits are validated, merged, and confirmed pushed to `origin/<working-branch>`** (`git merge-base --is-ancestor <dependabot_head_sha> origin/<working-branch>`).

## 2. Step-by-Step Consolidation Workflow

Use `./infra/scripts/consolidate_dependabot_prs.sh` (or run the equivalent steps below) whenever creating a new branch:

1. **Pull `main` & Create the Working Branch**:
   ```bash
   git checkout main && git pull origin main
   git checkout -b <feat|fix>/<descriptive-name>
   ```
2. **Fetch & Merge Open `app/dependabot` PRs into the Working Branch**:
   ```bash
   ./infra/scripts/consolidate_dependabot_prs.sh --merge
   ```
   - Fetches each open `app/dependabot` PR (`git fetch origin pull/<NUM>/head:dependabot-<NUM>`) and merges it into the current branch.
   - If two Dependabot PRs touch the same `package.json` / `package-lock.json`, resolve the version bumps cleanly and run `npm install --no-audit --no-fund` (and `npm --prefix apps/backend install --no-audit --no-fund`) to regenerate a consistent lockfile.
3. **Validate & Fix Any Breaking Dependency Changes**:
   - Run full local validation:
     ```bash
     ./infra/scripts/validate_local.sh --skip-e2e
     ```
   - If a bumped package introduces a type error, lint warning, or test failure, fix it on the working branch and re-run `./infra/scripts/validate_local.sh --skip-e2e` until 100% green.
4. **Push Working Branch to Canonical `origin`**:
   ```bash
   git push -u origin <working-branch>
   ```
5. **Close Superseded Dependabot PRs (Collaborator-Only & Ancestor-Verified)**:
   - Once the working branch is pushed to `origin` and verified to contain every Dependabot PR's changes, run:
     ```bash
     ./infra/scripts/consolidate_dependabot_prs.sh --close --target-pr <ACTIVE_PR_NUMBER>
     ```
   - This verifies collaborator permission (`admin`/`maintain`/`write`), confirms the branch exists on `origin`, closes each consolidated `app/dependabot` PR with an audit comment linking to `<ACTIVE_PR_NUMBER>`, and deletes the remote `dependabot/*` branch.
