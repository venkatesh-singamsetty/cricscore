#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function printUsage() {
  console.log(`Usage: node evals/run_ai_chat_eval.js --url <api-url> [--file <path>] [--out <path>] [--limit <n>]

Environment:
  CHAT_API_URL=<api-url> node evals/run_ai_chat_eval.js

Examples:
  node evals/run_ai_chat_eval.js --url https://api.example.com
  CHAT_API_URL=https://api.example.com node evals/run_ai_chat_eval.js
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (token === "--url") {
      args.url = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--file") {
      args.file = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--out") {
      args.out = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === "--limit") {
      args.limit = Number(argv[i + 1]);
      i += 1;
      continue;
    }
  }
  return args;
}

function normalizeUrl(rawUrl) {
  if (!rawUrl) {
    throw new Error("Missing API URL. Pass --url or set CHAT_API_URL.");
  }
  return rawUrl.replace(/\/$/, "");
}

async function callChat(apiUrl, prompt, matchId) {
  const start = Date.now();
  const response = await fetch(`${apiUrl}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: prompt,
      matchId,
      history: [],
      isAdmin: false,
    }),
  });

  const elapsedMs = Date.now() - start;
  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch {
    payload = { raw: responseText };
  }

  return {
    ok: response.ok,
    status: response.status,
    elapsedMs,
    payload,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    process.exit(0);
  }

  const apiUrl = normalizeUrl(args.url || process.env.CHAT_API_URL || "http://localhost:3000");
  const evalFile = args.file || path.join(__dirname, "ai-chat-eval.json");
  const outFile = args.out || path.join(__dirname, "latest-ai-chat-eval-results.json");

  let evalCases;
  try {
    evalCases = JSON.parse(fs.readFileSync(evalFile, "utf8"));
  } catch (error) {
    console.error(`Unable to read eval file at ${evalFile}: ${error.message}`);
    process.exit(1);
  }

  const limit = Number.isFinite(args.limit) && args.limit > 0 ? args.limit : evalCases.length;
  const selectedCases = evalCases.slice(0, limit);

  const results = [];
  let failed = 0;

  for (const testCase of selectedCases) {
    const result = await callChat(apiUrl, testCase.prompt, testCase.matchId || null);
    const summary = {
      id: testCase.id,
      category: testCase.category,
      prompt: testCase.prompt,
      expected_tool: testCase.expected_tool,
      ok: result.ok,
      status: result.status,
      elapsedMs: result.elapsedMs,
      replyPreview: (() => {
        const reply = result.payload?.reply || result.payload?.error || result.payload?.raw || "";
        return typeof reply === "string" ? reply.slice(0, 300) : JSON.stringify(reply).slice(0, 300);
      })(),
    };

    results.push(summary);

    if (!result.ok) {
      failed += 1;
    }

    console.log(`CASE ${testCase.id} | status=${result.status} | ok=${result.ok} | elapsed=${result.elapsedMs}ms`);
    console.log(`PROMPT: ${testCase.prompt}`);
    console.log(`REPLY: ${summary.replyPreview}`);
    console.log("---");
  }

  fs.writeFileSync(outFile, JSON.stringify({ apiUrl, total: results.length, failed, results }, null, 2));

  console.log(`Results saved to ${outFile}`);
  console.log(`Summary: ${results.length - failed}/${results.length} requests succeeded.`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Evaluation runner failed:", error.message);
  printUsage();
  process.exit(1);
});
