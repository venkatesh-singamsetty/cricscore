#!/usr/bin/env node
/**
 * Publication-grade Retina (2x) Architecture Diagram Generator for CricScore.
 * Renders all 5 diagrams in docs/images/architecture/ using clean HTML/SVG + Playwright Chromium.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const iconsDir = path.join(repoRoot, "docs/diagrams/icons");
const outDir = path.join(repoRoot, "docs/images/architecture");
fs.mkdirSync(outDir, { recursive: true });

const require = createRequire(
  path.join(repoRoot, "apps/e2e/package.json"),
);
const { chromium } = require("playwright");

function iconDataUri(fileName) {
  const fullPath = path.join(iconsDir, fileName);
  if (!fs.existsSync(fullPath)) return "";
  const b64 = fs.readFileSync(fullPath).toString("base64");
  return `data:image/png;base64,${b64}`;
}

const ICONS = {
  users: iconDataUri("tb_users.png"),
  mobile: iconDataUri("tb_device-mobile.png"),
  chat: iconDataUri("tb_message-chatbot.png"),
  shield: iconDataUri("tb_shield-lock.png"),
  robot: iconDataUri("tb_robot.png"),
  brain: iconDataUri("tb_brain.png"),
  chart: iconDataUri("tb_chart-line.png"),
  dbSearch: iconDataUri("tb_database-search.png"),
  postgres: iconDataUri("postgresql.png"),
  openai: iconDataUri("openai.png"),
  mcp: iconDataUri("mcp_hub.png"),
  stats: iconDataUri("agent_stats.png"),
  rules: iconDataUri("agent_rules.png"),
  weather: iconDataUri("agent_weather.png"),
  issue: iconDataUri("agent_issue.png"),
  openmeteo: iconDataUri("openmeteo.png"),
  github: iconDataUri("github.png"),
  ghActions: iconDataUri("githubactions.png"),
  dvc: iconDataUri("dvc.png"),
  sklearn: iconDataUri("scikitlearn.png"),
  mlflow: iconDataUri("mlflow.png"),
  xgboost: iconDataUri("xgboost.png"),
};

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
    background: #ffffff;
    color: #0f172a;
    -webkit-font-smoothing: antialiased;
  }
  .canvas {
    width: 1320px;
    padding: 28px 32px 30px;
    background: #ffffff;
    position: relative;
  }
  .header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 2px solid #e2e8f0;
  }
  .title {
    font-size: 22px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
  }
  .subtitle {
    font-size: 13px;
    font-weight: 600;
    color: #64748b;
  }
  .zone {
    border-radius: 14px;
    padding: 14px 16px;
    border: 1.5px solid #cbd5e1;
    background: #f8fafc;
  }
  .zone-blue { background: #eff6ff; border-color: #93c5fd; }
  .zone-orange { background: #fff7ed; border-color: #fdba74; }
  .zone-green { background: #f0fdf4; border-color: #86efac; }
  .zone-purple { background: #faf5ff; border-color: #d8b4fe; }
  .zone-slate { background: #f8fafc; border-color: #cbd5e1; }
  .zone-title {
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 10px;
  }
  .zt-blue { color: #1d4ed8; }
  .zt-orange { color: #c2410c; }
  .zt-green { color: #15803d; }
  .zt-purple { color: #7e22ce; }
  .zt-slate { color: #334155; }
  .node {
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
    border-radius: 11px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  }
  .node-v {
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
    border-radius: 11px;
    padding: 12px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 6px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  }
  .node-img {
    width: 34px;
    height: 34px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .badge {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 800;
    color: #ffffff;
    flex-shrink: 0;
  }
  .b-orange { background: linear-gradient(135deg, #f97316, #ea580c); }
  .b-purple { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
  .b-blue { background: linear-gradient(135deg, #3b82f6, #2563eb); }
  .b-green { background: linear-gradient(135deg, #22c55e, #16a34a); }
  .b-pink { background: linear-gradient(135deg, #ec4899, #db2777); }
  .b-red { background: linear-gradient(135deg, #ef4444, #dc2626); }
  .b-slate { background: linear-gradient(135deg, #475569, #334155); }
  .n-title {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.25;
  }
  .n-sub {
    font-size: 11px;
    font-weight: 500;
    color: #64748b;
    line-height: 1.3;
    margin-top: 2px;
  }
  .arrow-h {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    min-width: 54px;
  }
  .pill {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 999px;
    white-space: nowrap;
    margin-bottom: 3px;
  }
  .p-blue { background: #dbeafe; color: #1d4ed8; }
  .p-orange { background: #ffedd5; color: #c2410c; }
  .p-green { background: #dcfce7; color: #15803d; }
  .p-purple { background: #f3e8ff; color: #7e22ce; }
  .p-slate { background: #e2e8f0; color: #334155; }
  .line-h {
    width: 100%;
    height: 2px;
    position: relative;
  }
  .line-h::after {
    content: "";
    position: absolute;
    right: -1px;
    top: -4px;
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
  }
  .l-blue { background: #2563eb; } .l-blue::after { border-left: 7px solid #2563eb; }
  .l-orange { background: #ea580c; } .l-orange::after { border-left: 7px solid #ea580c; }
  .l-green { background: #16a34a; } .l-green::after { border-left: 7px solid #16a34a; }
  .l-purple { background: #7c3aed; } .l-purple::after { border-left: 7px solid #7c3aed; }
  .l-slate { background: #475569; } .l-slate::after { border-left: 7px solid #475569; }
`;

function arrowH(label, color = "blue", width = 62) {
  return `
    <div class="arrow-h" style="width:${width}px">
      ${label ? `<span class="pill p-${color}">${label}</span>` : ""}
      <div class="line-h l-${color}"></div>
    </div>
  `;
}

function wrapHtml(body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>${BASE_CSS}</style></head><body>${body}</body></html>`;
}

// ---------------------------------------------------------------------------
// 1. Platform Overview
// ---------------------------------------------------------------------------
function diagram01() {
  return wrapHtml(`
  <div class="canvas">
    <div class="header">
      <div class="title">CricScore Platform Overview</div>
      <div class="subtitle">AWS Serverless + Aiven PostgreSQL 16 (pgvector) · Dev + Prod ~$1/month</div>
    </div>

    <!-- Tier 1: Edge & CDN -->
    <div class="zone zone-blue" style="margin-bottom: 16px;">
      <div class="zone-title zt-blue">1. Edge, DNS & Static SPA Delivery</div>
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
        <div class="node" style="flex:1"><img class="node-img" src="${ICONS.users}"/><div><div class="n-title">Fans / Scorers / Admins</div><div class="n-sub">Web &amp; Mobile Browsers</div></div></div>
        ${arrowH("HTTPS", "blue", 64)}
        <div class="node" style="flex:1"><div class="badge b-purple">53</div><div><div class="n-title">Route 53 + ACM</div><div class="n-sub">Custom Domains · TLS 1.3</div></div></div>
        ${arrowH("Origin", "blue", 64)}
        <div class="node" style="flex:1"><div class="badge b-purple">CF</div><div><div class="n-title">CloudFront CDN + OAC</div><div class="n-sub">Global Edge Cache</div></div></div>
        ${arrowH("OAC", "blue", 58)}
        <div class="node" style="flex:1"><div class="badge b-green">S3</div><div><div class="n-title">S3 Static SPA</div><div class="n-sub">React 19 + /env-config.js</div></div></div>
      </div>
    </div>

    <!-- Middle 3-Column Grid: Auth/API -> Lambdas -> Data -->
    <div style="display:grid; grid-template-columns: 1fr 1.25fr 1fr; gap: 16px; margin-bottom: 16px;">
      <!-- Tier 2: Auth & API Edge -->
      <div class="zone zone-orange" style="display:flex; flex-direction:column; gap:10px;">
        <div class="zone-title zt-orange">2. Auth &amp; API Gateway Edge</div>
        <div class="node"><div class="badge b-red">CG</div><div><div class="n-title">Amplify + Cognito Pool</div><div class="n-sub">Sign In · Guest Pre-Signup · RS256 JWT</div></div></div>
        <div class="node"><div class="badge b-purple">API</div><div><div class="n-title">HTTP REST API Gateway</div><div class="n-sub">JWT Authorizer · 50 rps (5 rps /chat)</div></div></div>
        <div class="node"><div class="badge b-purple">WS</div><div><div class="n-title">WebSocket API Gateway</div><div class="n-sub">onconnect / ondisconnect / @connections</div></div></div>
        <div class="node"><div class="badge b-red">IAM</div><div><div class="n-title">Least-Privilege IAM + OIDC</div><div class="n-sub">Keyless GitHub Actions STS Auth</div></div></div>
      </div>

      <!-- Tier 3: Serverless Compute -->
      <div class="zone zone-purple" style="display:flex; flex-direction:column; gap:10px;">
        <div class="zone-title zt-purple">3. Serverless Compute (9 AWS Lambdas)</div>
        <div class="node"><div class="badge b-orange">&lambda;</div><div><div class="n-title">score-update + broadcaster + storage-worker</div><div class="n-sub">SNS (&lt;1s WS push) + SQS FIFO (ordered ACID writes)</div></div></div>
        <div class="node"><div class="badge b-orange">&lambda;</div><div><div class="n-title">match-api</div><div class="n-sub">Match CRUD · Admin RBAC · SES Scorecards · S3 Backups</div></div></div>
        <div class="node"><div class="badge b-orange">&lambda;</div><div><div class="n-title">chat-api (4-Agent MCP)</div><div class="n-sub">Read-Only SQL · pgvector RAG · Weather · GitHub Issues</div></div></div>
        <div class="node"><div class="badge b-orange">&lambda;</div><div><div class="n-title">ml-predict (Container Lambda)</div><div class="n-sub">Python 3.12 · XGBoost v2.2.0 + Markov DP + DLS</div></div></div>
      </div>

      <!-- Tier 4: Data, Registries & Email -->
      <div class="zone zone-green" style="display:flex; flex-direction:column; gap:10px;">
        <div class="zone-title zt-green">4. Data, Registries &amp; Delivery</div>
        <div class="node"><img class="node-img" src="${ICONS.postgres}"/><div><div class="n-title">Aiven PostgreSQL 16 + pgvector</div><div class="n-sub">dev/prod Schemas · HNSW Rulebook Vectors</div></div></div>
        <div class="node"><div class="badge b-blue">DB</div><div><div class="n-title">DynamoDB (On-Demand)</div><div class="n-sub">Active WebSocket Connection Registry</div></div></div>
        <div class="node"><div class="badge b-green">S3</div><div><div class="n-title">S3 Backups + ML Registry + ECR</div><div class="n-sub">Match JSON · models/v2.2.0 · 1 ECR Image (~309 MB)</div></div></div>
        <div class="node"><div class="badge b-blue">SES</div><div><div class="n-title">Amazon SES</div><div class="n-sub">Automated Post-Match HTML Scorecards</div></div></div>
      </div>
    </div>

    <!-- Tier 5: Observability & Cost -->
    <div class="zone zone-slate">
      <div class="zone-title zt-slate">5. Observability, Tracing &amp; Cost Guardrails</div>
      <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
        <div class="node"><div class="badge b-pink">CW</div><div><div class="n-title">CloudWatch Logs</div><div class="n-sub">7-Day Retention Cap</div></div></div>
        <div class="node"><div class="badge b-blue">XR</div><div><div class="n-title">AWS X-Ray</div><div class="n-sub">5% Active Trace Sampling</div></div></div>
        <div class="node"><div class="badge b-pink">AL</div><div><div class="n-title">Error Alarms + SNS</div><div class="n-sub">Real-Time Failure Alerts</div></div></div>
        <div class="node"><div class="badge b-green">$1</div><div><div class="n-title">AWS Budgets</div><div class="n-sub">~$1/mo Dev+Prod Ceiling</div></div></div>
      </div>
    </div>
  </div>
  `);
}

// ---------------------------------------------------------------------------
// 2. Live Scoring Flow
// ---------------------------------------------------------------------------
function diagram02() {
  return wrapHtml(`
  <div class="canvas">
    <div class="header">
      <div class="title">Live Scoring Flow: One Ball, Two Parallel Paths</div>
      <div class="subtitle">Decouples &lt;1s WebSocket fan-out from ordered ACID PostgreSQL persistence</div>
    </div>

    <div style="display:flex; align-items:center; gap: 12px;">
      <!-- Ingress -->
      <div style="display:flex; align-items:center; gap: 4px; flex-shrink:0;">
        <div class="node-v" style="width:108px; padding:10px 6px;"><img class="node-img" src="${ICONS.mobile}"/><div class="n-title">Scorer</div><div class="n-sub">Ball / Undo</div></div>
        ${arrowH("1. Ball", "orange", 46)}
        <div class="node-v" style="width:132px; padding:10px 6px;"><div class="badge b-purple">API</div><div class="n-title">HTTP API</div><div class="n-sub">POST /update-score</div></div>
        ${arrowH("2. Invoke", "orange", 56)}
        <div class="node-v" style="width:124px; padding:10px 6px;"><div class="badge b-orange">&lambda;</div><div class="n-title">score-update</div><div class="n-sub">200 OK (~30ms)</div></div>
      </div>

      <!-- Dual Parallel Paths -->
      <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:14px;">
        <!-- Fast Path -->
        <div class="zone zone-blue" style="padding:12px 14px;">
          <div class="zone-title zt-blue">Fast Path: Ephemeral &lt;1s Live Broadcast (Zero DB Wait)</div>
          <div style="display:flex; align-items:center; justify-content:space-between; gap:4px;">
            <div class="node-v" style="flex:1; min-width:0; padding:10px 6px;"><div class="badge b-pink">SNS</div><div class="n-title">SNS</div><div class="n-sub">match-events</div></div>
            ${arrowH("Trigger", "blue", 46)}
            <div class="node-v" style="flex:1; min-width:0; padding:10px 6px;"><div class="badge b-orange">&lambda;</div><div class="n-title">broadcaster</div><div class="n-sub">Fan-Out</div></div>
            ${arrowH("Lookup", "blue", 46)}
            <div class="node-v" style="flex:1; min-width:0; padding:10px 6px;"><div class="badge b-blue">DB</div><div class="n-title">DynamoDB</div><div class="n-sub">Sockets</div></div>
            ${arrowH("Push", "blue", 42)}
            <div class="node-v" style="flex:1; min-width:0; padding:10px 6px;"><div class="badge b-purple">WS</div><div class="n-title">WS API</div><div class="n-sub">@connections</div></div>
            ${arrowH("Stream", "blue", 46)}
            <div class="node-v" style="flex:1; min-width:0; padding:10px 6px;"><img class="node-img" src="${ICONS.users}"/><div class="n-title">Viewers</div><div class="n-sub">Live UI</div></div>
          </div>
        </div>

        <!-- Safe Path -->
        <div class="zone zone-green" style="padding:12px 14px;">
          <div class="zone-title zt-green">Safe Path: Guaranteed Ordered ACID Persistence</div>
          <div style="display:flex; align-items:center; gap:8px;">
            <div class="node-v" style="flex:1; min-width:0; padding:10px 8px;"><div class="badge b-pink">SQS</div><div class="n-title">Amazon SQS FIFO</div><div class="n-sub">storage-buffer.fifo (matchId)</div></div>
            ${arrowH("Poll (batch=1)", "green", 82)}
            <div class="node-v" style="flex:1; min-width:0; padding:10px 8px;"><div class="badge b-orange">&lambda;</div><div class="n-title">storage-worker</div><div class="n-sub">Chronological ACID Txn</div></div>
            ${arrowH("Persist", "green", 64)}
            <div class="node-v" style="flex:1.15; min-width:0; padding:10px 8px;"><img class="node-img" src="${ICONS.postgres}"/><div class="n-title">Aiven PostgreSQL 16</div><div class="n-sub">matches · innings · balls · undo</div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
  `);
}

// ---------------------------------------------------------------------------
// 3. Vector RAG Architecture
// ---------------------------------------------------------------------------
function diagram03Rag() {
  return wrapHtml(`
  <div class="canvas">
    <div class="header">
      <div class="title">Vector RAG Architecture: Tournament Rules Ingestion &amp; Retrieval</div>
      <div class="subtitle">PostgreSQL pgvector HNSW cosine search · 100% env-driven OpenAI-compatible embeddings</div>
    </div>

    <div style="display:flex; flex-direction:column; gap:16px;">
      <!-- Row 1: Ingestion -->
      <div class="zone zone-orange">
        <div class="zone-title zt-orange">1. Admin PDF Ingestion Path (POST /rules/upload · Cognito Admin JWT)</div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
          <div class="node-v" style="flex:1"><img class="node-img" src="${ICONS.mobile}"/><div class="n-title">Admin Upload</div><div class="n-sub">Rulebook PDF</div></div>
          ${arrowH("Admin JWT", "orange", 74)}
          <div class="node-v" style="flex:1"><div class="badge b-orange">&lambda;</div><div class="n-title">uploadRulesHandler</div><div class="n-sub">pdf-parse · ~1k Chars</div></div>
          ${arrowH("Batch Chunks", "orange", 86)}
          <div class="node-v" style="flex:1"><img class="node-img" src="${ICONS.openai}"/><div class="n-title">Embeddings API</div><div class="n-sub">text-embedding-3-small (1536-d)</div></div>
          ${arrowH("1536-d Vectors", "green", 92)}
          <div class="node-v" style="flex:1.15"><img class="node-img" src="${ICONS.postgres}"/><div class="n-title">PostgreSQL pgvector</div><div class="n-sub">tournament_rules (document_name, chunk_text)</div></div>
        </div>
      </div>

      <!-- Row 2: Retrieval & Grounded Answer -->
      <div class="zone zone-purple">
        <div class="zone-title zt-purple">2. Fan Query &amp; Grounded Synthesis Path (POST /chat · 5 rps Throttled)</div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
          <div class="node-v" style="flex:1"><img class="node-img" src="${ICONS.chat}"/><div class="n-title">Fan Question</div><div class="n-sub">"Powerplay rules?"</div></div>
          ${arrowH("Vectorize", "purple", 70)}
          <div class="node-v" style="flex:1"><img class="node-img" src="${ICONS.dbSearch}"/><div class="n-title">HNSW Cosine Search</div><div class="n-sub">embedding &lt;=&gt; $1 LIMIT 8</div></div>
          ${arrowH("Top-8 Chunks", "purple", 86)}
          <div class="node-v" style="flex:1"><img class="node-img" src="${ICONS.robot}"/><div class="n-title">Agent Supervisor</div><div class="n-sub">Context + Citation Rules</div></div>
          ${arrowH("Synthesize", "purple", 74)}
          <div class="node-v" style="flex:1.1"><img class="node-img" src="${ICONS.rules}"/><div class="n-title">Grounded Answer</div><div class="n-sub">Mandatory [Source: doc.pdf]</div></div>
        </div>
      </div>
    </div>
  </div>
  `);
}

// ---------------------------------------------------------------------------
// 4. Agentic AI Assistant (MCP)
// ---------------------------------------------------------------------------
function diagram04Ai() {
  return wrapHtml(`
  <div class="canvas">
    <div class="header">
      <div class="title">Agentic AI Assistant: Supervisor, In-Memory MCP &amp; Specialist Agents</div>
      <div class="subtitle">chat-api Lambda · Strict read-only guardrails &amp; credential isolation via InMemoryTransport</div>
    </div>

    <div style="display:grid; grid-template-columns: 1.05fr 1.35fr 1.15fr; gap: 16px; align-items: stretch;">
      <!-- Left: Orchestration -->
      <div class="zone zone-orange" style="display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
        <div class="zone-title zt-orange">1. Ingress &amp; Guardrails (chat-api)</div>
        <div class="node"><img class="node-img" src="${ICONS.chat}"/><div><div class="n-title">Fan / Scorer Chat UI</div><div class="n-sub">POST /chat (5 rps API GW Throttle)</div></div></div>
        <div class="node"><img class="node-img" src="${ICONS.shield}"/><div><div class="n-title">Security Guardrails</div><div class="n-sub">Read-Only SQL · PII Strip · 1-Issue Cap</div></div></div>
        <div class="node"><img class="node-img" src="${ICONS.robot}"/><div><div class="n-title">Agent Supervisor</div><div class="n-sub">Live Match Context + Tool Routing</div></div></div>
        <div class="node"><img class="node-img" src="${ICONS.openai}"/><div><div class="n-title">OpenAI-Compatible LLM</div><div class="n-sub">gpt-4o-mini (100% Env-Driven)</div></div></div>
        <div class="node"><img class="node-img" src="${ICONS.mcp}"/><div><div class="n-title">In-Memory MCP Hub</div><div class="n-sub">Isolates DB/GitHub Secrets from LLM</div></div></div>
      </div>

      <!-- Center: 4 Specialist MCP Tools -->
      <div class="zone zone-purple" style="display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
        <div class="zone-title zt-purple">2. Specialist MCP Tools</div>
        <div class="node"><img class="node-img" src="${ICONS.stats}"/><div><div class="n-title">Match Stats Agent</div><div class="n-sub">execute_sql · Parameterized Read-Only SELECT</div></div></div>
        <div class="node"><img class="node-img" src="${ICONS.rules}"/><div><div class="n-title">Tournament Rules Agent</div><div class="n-sub">search_tournament_rules · pgvector Top-8 RAG</div></div></div>
        <div class="node"><img class="node-img" src="${ICONS.weather}"/><div><div class="n-title">Weather Specialist Agent</div><div class="n-sub">get_match_weather · Hourly Rain &amp; DLS Advisories</div></div></div>
        <div class="node"><img class="node-img" src="${ICONS.issue}"/><div><div class="n-title">GitHub Issue Agent</div><div class="n-sub">create_github_issue · 2-Step User Confirmation</div></div></div>
      </div>

      <!-- Right: Backing Data Stores & APIs -->
      <div class="zone zone-green" style="display:flex; flex-direction:column; justify-content:space-between; gap:12px;">
        <div class="zone-title zt-green">3. Backing Data Stores &amp; APIs</div>
        <div class="node"><img class="node-img" src="${ICONS.postgres}"/><div><div class="n-title">Aiven PostgreSQL 16</div><div class="n-sub">3s BEGIN READ ONLY Transaction</div></div></div>
        <div class="node"><img class="node-img" src="${ICONS.dbSearch}"/><div><div class="n-title">PostgreSQL pgvector</div><div class="n-sub">HNSW Cosine Similarity Index</div></div></div>
        <div class="node"><img class="node-img" src="${ICONS.openmeteo}"/><div><div class="n-title">Open-Meteo API</div><div class="n-sub">Free Keyless Geocoding &amp; Forecast</div></div></div>
        <div class="node"><img class="node-img" src="${ICONS.github}"/><div><div class="n-title">GitHub REST API</div><div class="n-sub">venkatesh-singamsetty/cricscore Issues</div></div></div>
      </div>
    </div>
  </div>
  `);
}

// ---------------------------------------------------------------------------
// 5. MLOps & Win Prediction
// ---------------------------------------------------------------------------
function diagram05Mlops() {
  return wrapHtml(`
  <div class="canvas">
    <div class="header">
      <div class="title">Serverless MLOps &amp; Hybrid Win Prediction Pipeline</div>
      <div class="subtitle">Cricsheet DVC → 8-Model MLflow Benchmark → S3/ECR Registries → Hybrid XGBoost + Markov DP + DLS</div>
    </div>

    <div style="display:flex; flex-direction:column; gap:16px;">
      <!-- Row 1: Offline Training & Registry -->
      <div class="zone zone-purple">
        <div class="zone-title zt-purple">1. Offline Training, Experiment Tracking &amp; CI Quality Gate (mlops-pipeline.yml)</div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
          <div class="node-v" style="flex:1"><img class="node-img" src="${ICONS.chart}"/><div class="n-title">Cricsheet T20</div><div class="n-sub">786K+ Deliveries</div></div>
          ${arrowH("DVC Hash", "purple", 68)}
          <div class="node-v" style="flex:1"><img class="node-img" src="${ICONS.dvc}"/><div class="n-title">DVC Tracking</div><div class="n-sub">t20s_json.zip.dvc</div></div>
          ${arrowH("8 Models", "purple", 68)}
          <div class="node-v" style="flex:1"><img class="node-img" src="${ICONS.sklearn}"/><div class="n-title">8-Model Benchmark</div><div class="n-sub">Leakage-Free 70/15/15</div></div>
          ${arrowH("Log Runs", "purple", 68)}
          <div class="node-v" style="flex:1"><img class="node-img" src="${ICONS.mlflow}"/><div class="n-title">MLflow (File Store)</div><div class="n-sub">ROC-AUC · Brier · Latency</div></div>
          ${arrowH("Gate", "orange", 56)}
          <div class="node-v" style="flex:1.1"><img class="node-img" src="${ICONS.xgboost}"/><div class="n-title">XGBoost v2.2.0</div><div class="n-sub">Acc &ge;60% · AUC 0.7723</div></div>
        </div>
      </div>

      <!-- Row 2: Registries & Real-Time Serving -->
      <div class="zone zone-green">
        <div class="zone-title zt-green">2. Artifact Registries &amp; Real-Time Hybrid Lambda Inference (POST /match/predict)</div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
          <div class="node-v" style="flex:1.1"><div class="badge b-green">S3</div><div class="n-title">S3 Model Registry</div><div class="n-sub">models/v2.2.0 (.joblib + SHA-256)</div></div>
          ${arrowH("Verify /tmp", "green", 76)}
          <div class="node-v" style="flex:1.1"><div class="badge b-orange">ECR</div><div class="n-title">ECR Container</div><div class="n-sub">xgboost-cpu (~309 MB, 1 img)</div></div>
          ${arrowH("Invoke", "green", 62)}
          <div class="node-v" style="flex:1.1"><div class="badge b-orange">&lambda;</div><div class="n-title">ml-predict Lambda</div><div class="n-sub">5s --model-version Rollback</div></div>
          ${arrowH("Blend", "green", 58)}
          <div class="node-v" style="flex:1.15"><img class="node-img" src="${ICONS.brain}"/><div class="n-title">Hybrid Win Engine</div><div class="n-sub">XGBoost + Markov DP + DLS</div></div>
          ${arrowH("Win %", "blue", 58)}
          <div class="node-v" style="flex:0.95"><img class="node-img" src="${ICONS.users}"/><div class="n-title">Live Scoreboard</div><div class="n-sub">Every Delivery</div></div>
        </div>
      </div>
    </div>
  </div>
  `);
}

// ---------------------------------------------------------------------------
// 6. Immutable CI/CD Pipeline & Tag-Based Rollback
// ---------------------------------------------------------------------------
function diagram06Cicd() {
  return wrapHtml(`
  <div class="canvas">
    <div class="header">
      <div class="title">Immutable 2-Env CI/CD Pipeline &amp; 1-Click Tag Rollback</div>
      <div class="subtitle">GitHub Actions (Keyless OIDC) · Build Once (SHA-256) → DEV → Manual PROD Approval → Post-PROD vX.Y.Z Tag</div>
    </div>

    <div style="display:flex; flex-direction:column; gap:14px;">
      <!-- Row 1: PR & Build Once -> DEV -->
      <div class="zone zone-blue">
        <div class="zone-title zt-blue">1. Pull Request Gates &amp; Main Branch Build-Once → DEV Verification (ci.yml)</div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:5px;">
          <div class="node-v" style="flex:1; min-width:0; padding:10px 8px;"><img class="node-img" src="${ICONS.github}"/><div class="n-title">PR + Local Hook</div><div class="n-sub">--fast (~11s) · Path-Filtered CI · CodeQL</div></div>
          ${arrowH("Merge", "blue", 54)}
          <div class="node-v" style="flex:1; min-width:0; padding:10px 8px;"><div class="badge b-green">S3</div><div class="n-title">Build Once</div><div class="n-sub">Frontend + Lambdas + SHA256SUMS.txt</div></div>
          ${arrowH("SHA-256", "blue", 64)}
          <div class="node-v" style="flex:1; min-width:0; padding:10px 8px;"><img class="node-img" src="${ICONS.ghActions}"/><div class="n-title">Deploy DEV</div><div class="n-sub">Migrate · TF Apply · /env-config.js</div></div>
          ${arrowH("Parallel", "blue", 60)}
          <div class="node-v" style="flex:1.15; min-width:0; padding:10px 8px;"><img class="node-img" src="${ICONS.shield}"/><div class="n-title">Verify DEV (Parallel)</div><div class="n-sub">AI Eval + 15 E2E | ZAP + Syft SBOM</div></div>
        </div>
      </div>

      <!-- Row 2: Manual PROD Approval -> Immutable Promotion -> Post-PROD SemVer Tag -->
      <div class="zone zone-green">
        <div class="zone-title zt-green">2. Manual PROD Approval, Zero-Rebuild Promotion &amp; Post-PROD SemVer Release (cd.yml)</div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:5px;">
          <div class="node-v" style="flex:1; min-width:0; padding:10px 8px;"><div class="badge b-orange">&#10003;</div><div class="n-title">PROD Approval</div><div class="n-sub">Required Reviewer · No Tag Yet</div></div>
          ${arrowH("Verify SHA", "green", 70)}
          <div class="node-v" style="flex:1; min-width:0; padding:10px 8px;"><img class="node-img" src="${ICONS.ghActions}"/><div class="n-title">Promote PROD</div><div class="n-sub">Zero Rebuild · Exact S3 Bundle</div></div>
          ${arrowH("Parallel", "green", 60)}
          <div class="node-v" style="flex:1.1; min-width:0; padding:10px 8px;"><img class="node-img" src="${ICONS.shield}"/><div class="n-title">Verify PROD (Parallel)</div><div class="n-sub">AI Eval + 15 E2E | ZAP + SBOM</div></div>
          ${arrowH("Pass Only", "purple", 68)}
          <div class="node-v" style="flex:1.15; min-width:0; padding:10px 8px;"><div class="badge b-purple">TAG</div><div class="n-title">Publish vX.Y.Z</div><div class="n-sub">SemVer Tag · Changelog · S3 Archive</div></div>
        </div>
      </div>

      <!-- Row 3: 1-Click Tag-Based Rollback -->
      <div class="zone zone-orange">
        <div class="zone-title zt-orange">3. 1-Click Tag-Based Rollback (cd.yml workflow_dispatch: action=rollback)</div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
          <div class="node" style="flex:1"><div class="badge b-red">RB</div><div><div class="n-title">Select Release Tag</div><div class="n-sub">target_ref: previous or vX.Y.Z</div></div></div>
          ${arrowH("Pull Archive", "orange", 78)}
          <div class="node" style="flex:1"><div class="badge b-green">S3</div><div><div class="n-title">Verify S3 Release Bundle</div><div class="n-sub">releases/vX.Y.Z/ + SHA256SUMS.txt</div></div></div>
          ${arrowH("Restore ~60s", "orange", 86)}
          <div class="node" style="flex:1.15"><img class="node-img" src="${ICONS.ghActions}"/><div><div class="n-title">Restore PROD + Re-Verify</div><div class="n-sub">Zero Rebuild · TF Apply · S3/CF Sync · E2E</div></div></div>
        </div>
      </div>
    </div>
  </div>
  `);
}

const DIAGRAMS = [
  ["01_platform_overview.png", diagram01()],
  ["02_live_scoring_flow.png", diagram02()],
  ["03_vector_rag_architecture.png", diagram03Rag()],
  ["03_ai_assistant.png", diagram04Ai()],
  ["04_mlops_win_prediction.png", diagram05Mlops()],
  ["05_cicd_immutable_promotion.png", diagram06Cicd()],
];

let browser;
try {
  browser = await chromium.launch();
} catch {
  browser = await chromium.launch({ channel: "chrome" });
}
try {
  const context = await browser.newContext({
    viewport: { width: 1320, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  for (const [filename, html] of DIAGRAMS) {
    await page.setContent(html, { waitUntil: "load" });
    const el = page.locator(".canvas");
    const outPath = path.join(outDir, filename);
    await el.screenshot({ path: outPath });
    console.log("✅ Rendered", outPath);
  }
} finally {
  await browser.close();
}
