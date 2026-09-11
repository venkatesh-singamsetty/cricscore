# AI Chat Evaluations

This folder contains a lightweight evaluation baseline for the CricScore AI chat experience.

## Purpose

The chat bot has three main risk areas:

- tool selection correctness
- SQL safety and correctness
- grounded answer quality

These evaluations are designed to track those risks before broader production rollout.

## Files

- `ai-chat-eval.json` — prompt set + expected behavior + rubric
- `run_ai_chat_eval.js` — executes the prompt set against the deployed chat API and saves a result report

## Usage

```bash
# against a deployed API
node evals/run_ai_chat_eval.js --url https://your-api-url

# against a local dev instance
CHAT_API_URL=http://localhost:3000 node evals/run_ai_chat_eval.js

# optional: limit to the first N cases
node evals/run_ai_chat_eval.js --url https://your-api-url --limit 5
```

The script:

1. sends each prompt to the chat endpoint
2. records HTTP success and latency
3. captures the returned reply preview
4. saves the results to `evals/latest-ai-chat-eval-results.json`

## Baseline rubric

Score each case on a 0-1 or 0-2 scale:

- tool selection correctness
- groundedness to facts
- safety / refusal quality
- answer clarity
- citation quality for rulebook queries

A simple success threshold is to keep the overall pass rate above 90% for the baseline set.

## Recommended next steps

- expand the evaluation set to 20-50 prompts
- add production-run reruns for dev and prod separately
- track latency alongside correctness
- gate major AI changes behind the evaluation script
