# CricScore Custom Agent Skills & Antigravity Framework Guide

This document explains the custom **Agent Skills** created for the CricScore repository and how they integrate with **Antigravity**.

---

## 1. What are Agent Skills & How Do They Work with Antigravity?

**Antigravity** is Google DeepMind's agentic AI coding framework. It uses modular project-scoped instructions and skill packages defined under the `.agents/` folder in your codebase.

### 🤖 Agent Rules (`AGENTS.md`) vs 🧰 Agent Skills (`SKILL.md`)

| Feature           | Agent Rule (`AGENTS.md`)              | Agent Skill (`SKILL.md`)               |
| :---------------- | :------------------------------------ | :------------------------------------- |
| **Primary Focus** | System Directives, Safety, Guardrails | How-To Playbooks, Domain Logic         |
| **Activation**    | Always active in **EVERY** session    | Loaded dynamically when relevant       |
| **Location**      | `.agents/AGENTS.md`                   | `.agents/skills/<skill-name>/SKILL.md` |
| **Analogy**       | **The Laws & Constraints**            | **Specialist Reference Manual**        |

- **Agent Rules (`AGENTS.md`)**: Enforces non-bypassable constraints (e.g. _"Never push directly to main"_, _"Never create paid NAT Gateways"_).
- **Agent Skills (`SKILL.md`)**: Provides step-by-step technical instructions (e.g. how to calculate cricket overs, run local pre-push scripts, or manage PostgreSQL connection pools).

---

## 2. Agent Skills Created for CricScore

We created three dedicated skills tailored specifically to this codebase:

### 🛠️ 1. `cricscore-workflow-and-validation`

- **Location:** [`.agents/skills/cricscore-workflow-and-validation/SKILL.md`](file:///Users/venkat/workspace/gitRepos/cricscore/.agents/skills/cricscore-workflow-and-validation/SKILL.md)
- **Purpose:** Enforces PR workflow, local testing checks (`./infra/scripts/pre-push-check.sh`), non-direct-main push policies, and the Semantic Release + PROD deployment lifecycle.

### 🏏 2. `cricscore-score-engine-architecture`

- **Location:** [`.agents/skills/cricscore-score-engine-architecture/SKILL.md`](file:///Users/venkat/workspace/gitRepos/cricscore/.agents/skills/cricscore-score-engine-architecture/SKILL.md)
- **Purpose:** Guides live score calculation rules, batting team score formatting, cricket overs notation (`1.5` = 1 over 5 balls), and state sync mechanics across Lambdas, SNS/SQS, and WebSockets.

### 💰 3. `cricscore-cost-and-infrastructure-best-practices`

- **Location:** [`.agents/skills/cricscore-cost-and-infrastructure-best-practices/SKILL.md`](file:///Users/venkat/workspace/gitRepos/cricscore/.agents/skills/cricscore-cost-and-infrastructure-best-practices/SKILL.md)
- **Purpose:** Prevents trial-and-error CI testing by requiring local validation (`./infra/scripts/pre-push-check.sh`), mandates CloudWatch 7-day log retention, RDS connection pooling, and SSM Parameter Store cost optimizations.

---

## 3. Global & Project Rules (`AGENTS.md`)

- **Location:** [`.agents/AGENTS.md`](file:///Users/venkat/workspace/gitRepos/cricscore/.agents/AGENTS.md)
- Contains strict system-level directives that the AI assistant MUST follow without exception (e.g. forbidding direct pushes to `main`, requiring local pre-push validation, and enforcing AWS cost bounds).

---

## 4. 🚀 Quick Tutorial: How to Create Your Own Agent Skill

If you want to add a new custom skill for your team or project, follow this 3-step tutorial:

### Step 1: Create the Skill Directory & `SKILL.md` File

Inside your repo, create a folder under `.agents/skills/<skill-name>/` with a `SKILL.md` file:

```bash
mkdir -p .agents/skills/my-custom-skill
touch .agents/skills/my-custom-skill/SKILL.md
```

### Step 2: Add YAML Frontmatter & Instructions

The `SKILL.md` must start with YAML frontmatter containing `name` and `description`:

```markdown
---
name: my-custom-skill
description: Brief summary of when the agent should trigger and use this skill.
---

# My Custom Skill Title

Write step-by-step instructions, CLI commands, or domain rules here for the agent:

1. Always run unit tests before making changes.
2. Follow strict naming conventions.
```

### Step 3: Test & Verify

When you start a session with Antigravity, the agent automatically scans `.agents/skills/` and loads your new skill! You can ask:

> _"Use my-custom-skill to run the database check"_
> And the agent will read and execute the instructions defined in your `SKILL.md` file.
