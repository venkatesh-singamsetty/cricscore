# 🖼️ Architecture Diagram Images

The four architecture images in the main [README](../../README.md) are generated as code with the [`diagrams`](https://diagrams.mingrammer.com/) Python library and Graphviz.

| Image                                                                               | What it shows                                      |
| ----------------------------------------------------------------------------------- | -------------------------------------------------- |
| [`01_platform_overview.png`](../images/architecture/01_platform_overview.png)       | Edge, identity, APIs, Lambda compute, and data     |
| [`02_live_scoring_flow.png`](../images/architecture/02_live_scoring_flow.png)       | One ball: SNS fast path and SQS safe path          |
| [`03_ai_assistant.png`](../images/architecture/03_ai_assistant.png)                 | `chat-api` guardrails, LLM tool choice, MCP tools  |
| [`04_mlops_win_prediction.png`](../images/architecture/04_mlops_win_prediction.png) | DVC → MLflow → quality gates → S3/ECR → ml-predict |

The editable Mermaid versions live in [`docs/architecture.md`](../architecture.md).

## Regenerate

Graphviz must be installed (`brew install graphviz` on macOS, `sudo apt-get install graphviz` on Ubuntu). Use a throwaway virtual environment so nothing is added to the app dependencies:

```bash
python3 -m venv /tmp/diagrams-venv
/tmp/diagrams-venv/bin/pip install diagrams
/tmp/diagrams-venv/bin/python docs/diagrams/generate_architecture_diagrams.py
```

PNGs are written to `docs/images/architecture/`. Commit the script change and the regenerated images in the same PR.

## Icons

- **AWS services** use the official AWS Architecture Icons bundled with `diagrams` (`diagrams.aws.*`).
- **Non-AWS services** use PNGs in [`icons/`](./icons):
  - Brand logos from [Simple Icons](https://simpleicons.org/) (PostgreSQL, GitHub, GitHub Actions, DVC, MLflow, scikit-learn, OpenAI).
  - Site favicons for XGBoost and Open-Meteo.
  - Generic concepts (users, chat, guardrails, agent, rain, database search) from [Tabler Icons](https://tabler.io/icons) (MIT).

Brand logos are trademarks of their owners and are used here only to identify the services in the diagrams.

## Keep the images accurate

Update `generate_architecture_diagrams.py` whenever a Lambda, API route group, queue/topic, data store, MCP tool, or ML pipeline stage is added or removed, then regenerate. Check that the Mermaid diagrams in `docs/architecture.md` still match.
