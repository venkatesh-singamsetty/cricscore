/**
 * chat-api Lambda — Entry Point
 *
 * This file is intentionally kept as a THIN ROUTER only.
 * All business logic lives in the handlers/ and mcp/ subdirectories.
 *
 * Route map:
 *   POST /chat/summary   → handlers/summaryHandler.js  (AI post-match summary)
 *   POST /rules/upload   → handlers/uploadRulesHandler.js  (PDF ingestion + embedding)
 *   POST /chat           → handlers/chatHandler.js  (Agentic RAG chat via MCP)
 */

const { chatHandler } = require("./handlers/chatHandler");
const { summaryHandler } = require("./handlers/summaryHandler");
const { uploadRulesHandler } = require("./handlers/uploadRulesHandler");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "OPTIONS,GET,POST,DELETE",
};

exports.handler = async (event) => {
  // Handle preflight CORS requests
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  try {
    const path =
      event.rawPath || event.requestContext?.http?.path || event.path || "";

    // Route: AI Post-Match Summary
    if (path.includes("/chat/summary")) {
      const body = JSON.parse(event.body || "{}");
      return await summaryHandler(body.matchId, corsHeaders);
    }

    // Route: List Tournament Rulebooks
    if (event.httpMethod === "GET" && path.includes("/rules")) {
      const { listRulesHandler } = require("./handlers/listRulesHandler");
      return await listRulesHandler(event, corsHeaders);
    }

    // Route: Delete Tournament Rulebook
    if (event.httpMethod === "DELETE" && path.includes("/rules")) {
      const { deleteRulesHandler } = require("./handlers/deleteRulesHandler");
      return await deleteRulesHandler(event, corsHeaders);
    }

    // Route: Tournament Rulebook PDF Upload + Embedding
    if (event.httpMethod === "POST" && path.includes("/rules/upload")) {
      return await uploadRulesHandler(event, corsHeaders);
    }

    // Route: Main Agentic AI Chat (MCP + RAG)
    const body = JSON.parse(event.body || "{}");
    return await chatHandler(body, corsHeaders);
  } catch (error) {
    console.error("chat-api handler error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};
