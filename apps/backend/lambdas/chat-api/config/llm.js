const { OpenAI } = require("openai");

/**
 * Shared LLM & Embedding client configuration.
 * 100% environment-variable driven — supports OpenAI (default), Google Gemini
 * (OpenAI-compatible endpoint), OpenRouter, Groq, or separate chat/embedding
 * providers in parallel without code changes.
 */
const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
const baseURL = (
  process.env.LLM_BASE_URL || "https://api.openai.com/v1"
).replace(/\/$/, "");

const defaultHeaders = { "X-Title": "CricScore" };
if (process.env.FRONTEND_URL) {
  defaultHeaders["HTTP-Referer"] = process.env.FRONTEND_URL;
}

const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: baseURL,
  fetch: globalThis.fetch,
  defaultHeaders,
});

/**
 * Extracts the lowercase hostname from a URL string safely.
 */
function getHostname(rawUrl) {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Returns the default chat model name based on the configured LLM base URL.
 */
function getDefaultModel() {
  const host = getHostname(baseURL);
  if (host === "generativelanguage.googleapis.com") {
    return "gemini-2.5-flash";
  }
  if (host === "api.groq.com" || host.endsWith(".groq.com")) {
    return "llama-3.3-70b-versatile";
  }
  return "gpt-4o-mini";
}

const LLM_MODEL = process.env.LLM_MODEL || getDefaultModel();

const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY || apiKey;
const EMBEDDING_BASE_URL = (process.env.EMBEDDING_BASE_URL || baseURL).replace(
  /\/$/,
  "",
);

function getDefaultEmbeddingModel() {
  const host = getHostname(EMBEDDING_BASE_URL);
  if (host === "generativelanguage.googleapis.com") {
    return "gemini-embedding-001";
  }
  return "text-embedding-3-small";
}

const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || getDefaultEmbeddingModel();

const parsedDims = Number.parseInt(
  process.env.EMBEDDING_DIMENSIONS || "1536",
  10,
);
const EMBEDDING_DIMENSIONS =
  Number.isFinite(parsedDims) && parsedDims > 0 ? parsedDims : 1536;

module.exports = {
  openai,
  LLM_MODEL,
  EMBEDDING_API_KEY,
  EMBEDDING_BASE_URL,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
};
