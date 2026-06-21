# 🚀 Automated Release & Versioning Process

CricScore utilizes **Semantic Release** in combination with **Conventional Commits** to fully automate the versioning, tagging, and release notes generation for the application.

By removing human error from versioning, the project adheres to strict Semantic Versioning (`v[Major].[Minor].[Patch]`) without requiring manual updates to `package.json` files.

---

## 1. The Conventional Commit Standard

While working on your local branches, every commit message must follow the Conventional Commits format. This prefix tells the system what kind of work was done.

| Commit Prefix | Purpose                                                    | Triggers Version Bump                 | Example                            |
| :------------ | :--------------------------------------------------------- | :------------------------------------ | :--------------------------------- |
| `fix:`        | A bug fix.                                                 | **PATCH** (e.g., `v1.0.0` ➔ `v1.0.1`) | `fix: resolve CORS issue on API`   |
| `feat:`       | A new feature.                                             | **MINOR** (e.g., `v1.0.0` ➔ `v1.1.0`) | `feat: add dark mode to dashboard` |
| `perf:`       | A code change that improves performance.                   | None                                  | `perf: optimize database query`    |
| `chore:`      | Routine tasks, maintenance, or dependency updates.         | None                                  | `chore: update dependencies`       |
| `docs:`       | Documentation changes only.                                | None                                  | `docs: update cost management`     |
| `refactor:`   | A code change that neither fixes a bug nor adds a feature. | None                                  | `refactor: extract scoring logic`  |

_Note: If you add `BREAKING CHANGE:` to the footer of any commit, it will trigger a **MAJOR** version bump (e.g., `v1.0.0` ➔ `v2.0.0`)._

---

## 2. The Release Lifecycle

The release process is entirely hands-off. Here is the exact lifecycle of how code travels from your machine to an official GitHub Release:

### Step 1: Branching & Committing

You create a feature branch (e.g., `feature/login`) and commit your code using the prefixes above. **At this stage, no version changes or tags are created.** Your local Husky hooks ensure the code is formatted and free of secrets.

### Step 2: Pull Request

You raise a Pull Request against the `main` branch. GitHub Actions will execute all unit tests, infrastructure scans, and E2E checks.

### Step 3: Merge to Main

Once the PR is approved and checks pass, you merge the branch into `main`. The exact moment the code hits `main`, the `.github/workflows/release.yml` GitHub Action is triggered.

### Step 4: Mathematical Version Calculation

The `semantic-release` bot analyzes every commit message merged since the last release tag. It mathematically calculates the next semantic version based strictly on the prefixes (`fix`, `feat`, etc.) found in the commit history.

### Step 5: Tagging & Changelog Generation

Once the new version number is calculated, the bot automatically:

1. Parses your commit messages into a beautifully formatted, human-readable markdown **Changelog**.
2. Creates an official **Git Tag** (e.g., `v2.9.0`) on the `main` branch.
3. Publishes an official **GitHub Release** on the repository's Releases page, attaching the changelog.

---

## ⚠️ Important Note on `package.json` Versions

Because CricScore is an AWS Serverless application and a deployed React Single-Page Application (SPA)—and **not** a published NPM module—**you no longer need to manually manage the `"version"` field inside your `package.json` files.**

The versioning of this platform is managed entirely at the Git layer via Git Tags and GitHub Releases. The static `package.json` version numbers can be safely ignored.
