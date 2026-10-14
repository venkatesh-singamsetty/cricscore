# CricScore project guidance

- Read the relevant skill under `.agents/skills/` for the task at hand; do not load every skill for unrelated work.
- Use source code, tests, Terraform, and current workflow files as factual references. Skills and docs can drift; verify their claims and correct outdated project guidance when directly relevant.
- Keep changes focused, preserve existing behavior, and add or update regression tests for behavior changes.
- Before deployment or other external side effects, confirm the target environment and inspect the operation's impact. Never expose `.env.local` or other secrets.
