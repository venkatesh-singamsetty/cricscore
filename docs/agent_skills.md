# CricScore Agent Skills

CricScore keeps focused, project-specific agent guidance under `.agents/skills/<skill-name>/SKILL.md`. Each skill should describe a recurring task, have a clear activation description, and provide actionable, verified project guidance. Read only the skill relevant to the current task.

## Current skills

| Skill                                | Use for                                                             |
| ------------------------------------ | ------------------------------------------------------------------- |
| `cricscore-code-review-standards`    | Reviewing diffs and reporting actionable findings                   |
| `cricscore-security-standards`       | Secrets, trust boundaries, secure coding, and security checks       |
| `cricscore-pr-and-workflow`          | Branches, pull requests, CI/CD, and developer commands              |
| `cricscore-dependabot-consolidation` | Consolidating open Dependabot PRs into feature branches             |
| `cricscore-cost-governance`          | AWS cost implications and cost-sensitive proposals                  |
| `cricscore-infrastructure-standards` | Terraform, state, AWS infrastructure, and deployments               |
| `cricscore-frontend-architecture`    | React UI, live state, and responsive behavior                       |
| `cricscore-backend-architecture`     | Lambda APIs, scoring events, PostgreSQL access, and synchronization |
| `cricscore-mlops-standards`          | Win-prediction model training and inference                         |
| `cricscore-testing-standards`        | Selecting and writing tests across the stack                        |
| `cricscore-agentic-rag-architecture` | Chat, LLM configuration, MCP tools, and retrieval                   |
| `cricscore-database-migrations`      | PostgreSQL schema evolution and deployment migrations               |

## Host integration

Skill discovery depends on the AI tool and its repository configuration. This repository also contains `.github/copilot-instructions.md` and a legacy `.cursorrules` file, but the presence of Markdown files alone does not make every host load these skills automatically. Verify host support and consult its current customization documentation rather than claiming universal automatic discovery.

Keep the catalog references in `README.md`, `.cursorrules`, and `.github/copilot-instructions.md` in sync when the skill set changes. Prefer updating a relevant skill over adding a narrowly duplicated one; remove skills that no longer provide distinct, verified workflows.
