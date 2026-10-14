---
name: cricscore-code-review-standards
description: Use when reviewing a CricScore pull request, branch diff, or code change for correctness, regressions, security, data integrity, or missing tests.
---

# CricScore Code Review Standards

Review the complete diff against its target branch and follow each changed behavior through its callers, consumers, persistence, and UI where relevant. Use repository tests and documentation to verify assumptions; do not treat a passing test run as proof that a change is correct.

## Review priorities

1. Identify concrete defects: incorrect behavior, broken contracts, data loss/corruption, authorization gaps, security exposure, race conditions, or failure paths.
2. Check that changes preserve existing scoring semantics, event ordering, environment separation, API compatibility, and responsive behavior where applicable.
3. Check that regression tests cover changed behavior and meaningful edge cases; verify that the commands selected match the affected stack.
4. Check infrastructure/workflow changes for unintended resource replacement, unsafe deployment ordering, secret exposure, and cost impact.
5. Ignore unrelated style preferences and pre-existing issues. Do not request feature expansion beyond the stated change.

## Findings

- Report only actionable findings, ordered by severity: critical, high, medium, low.
- For each finding, give the affected file and line, the concrete scenario and impact, and a concise fix direction. Keep the location within the changed lines when possible.
- State when no findings were found. List important validation gaps separately from defects.
- Do not modify files, push, or merge as part of a review unless asked to implement a fix.
