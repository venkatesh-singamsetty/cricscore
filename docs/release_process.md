# 🚀 Automated Release & Versioning Process

CricScore utilizes **Semantic Release** in combination with **Conventional Commits** to fully automate the versioning, tagging, and release notes generation for the application.

By removing human error from versioning, the project adheres to strict Semantic Versioning (`v[Major].[Minor].[Patch]`) without requiring manual updates to `package.json` files.

---

## 1. The Conventional Commit Standard

While working on your local branches, every commit message must follow the Conventional Commits format. This prefix tells the system what kind of work was done.

| Commit Prefix | Purpose                                                    | Triggers Version Bump?                  | Example                            |
| :------------ | :--------------------------------------------------------- | :-------------------------------------- | :--------------------------------- |
| `feat:`       | A new feature.                                             | ✅ **Yes** (MINOR: `v3.0` ➔ `v3.1`)     | `feat: add dark mode to dashboard` |
| `fix:`        | A bug fix.                                                 | ✅ **Yes** (PATCH: `v3.0.0` ➔ `v3.0.1`) | `fix: resolve CORS issue on API`   |
| `perf:`       | A code change that improves performance.                   | ❌ **No** (Skips Release)               | `perf: optimize database query`    |
| `docs:`       | Documentation changes only.                                | ❌ **No** (Skips Release)               | `docs: update cost management`     |
| `build:`      | Build system or external dependency updates.               | ❌ **No** (Skips Release)               | `build: update semantic release`   |
| `ci:`         | Changes to CI/CD configuration files and scripts.          | ❌ **No** (Skips Release)               | `ci: fix github action syntax`     |
| `chore:`      | Routine tasks, maintenance, or dependency updates.         | ❌ **No** (Skips Release)               | `chore: update dependencies`       |
| `refactor:`   | A code change that neither fixes a bug nor adds a feature. | ❌ **No** (Skips Release)               | `refactor: extract scoring logic`  |
| `test:`       | Adding missing tests or correcting existing tests.         | ❌ **No** (Skips Release)               | `test: add match-api unit tests`   |

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

The `semantic-release` bot analyzes every commit message merged since the last release tag. It mathematically calculates the next semantic version based strictly on the prefixes (`fix`, `feat`, etc.) found in the commit history:

- **`feat:`** ➔ Triggers a **MINOR** release (e.g., `v3.0.0` ➔ `v3.1.0`)
- **`fix:`** or **`perf:`** ➔ Triggers a **PATCH** release (e.g., `v3.0.0` ➔ `v3.0.1`)
- **`BREAKING CHANGE:`** (in footer) ➔ Triggers a **MAJOR** release (e.g., `v3.0.0` ➔ `v4.0.0`)

> [!NOTE]
> If a Pull Request ONLY contains commits starting with **`docs:`**, **`build:`**, **`chore:`**, **`refactor:`**, **`test:`**, or **`ci:`**, Semantic Release will **intentionally skip** creating a new release tag. This prevents spamming users with empty version bumps for purely internal maintenance.

### Step 5: Tagging & Changelog Generation

Once the new version number is calculated, the bot automatically:

1. Parses your commit messages into a beautifully formatted, human-readable markdown **Changelog**.
2. Creates an official **Git Tag** (e.g., `v2.9.0`) on the `main` branch.
3. Publishes an official **GitHub Release** on the repository's Releases page, attaching the changelog.
4. Uses the `@semantic-release/changelog` plugin to generate a physical `CHANGELOG.md` file in the repository.

### Step 6: Bypassing Branch Protection for Changelog Sync

Because the `main` branch has strict Branch Protection enabled (requiring Pull Requests), the automated bot cannot push the `CHANGELOG.md` file directly to `main` using the default `GITHUB_TOKEN`.

To solve this, the `.github/workflows/release.yml` workflow is configured to use a **Personal Access Token (PAT)** stored in the repository secrets as `GH_PAT`. This token belongs to a repository administrator, allowing the Semantic Release bot to bypass the Pull Request requirement and silently commit the `CHANGELOG.md` file directly to the root of the repository without throwing an "Access Denied" error.

---

## ⚠️ Important Note on `package.json` Versions

Because CricScore is an AWS Serverless application and a deployed React Single-Page Application (SPA)—and **not** a published NPM module—**you no longer need to manually manage the `"version"` field inside your `package.json` files.**

The versioning of this platform is managed entirely at the Git layer via Git Tags and GitHub Releases. The static `package.json` version numbers can be safely ignored.
