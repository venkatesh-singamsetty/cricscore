const { OpenAI } = require("openai");

/**
 * Shared LLM client configuration.
 * Supports OpenRouter (default), Groq, or any OpenAI-compatible provider
 * via LLM_BASE_URL and LLM_API_KEY environment variables.
 */
const apiKey = process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
const baseURL =
  process.env.LLM_BASE_URL ||
  (process.env.OPENAI_API_KEY
    ? "https://api.openai.com/v1"
    : "https://openrouter.ai/api/v1");

const openai = new OpenAI({
  apiKey: apiKey,
  baseURL: baseURL,
  fetch: globalThis.fetch,
  defaultHeaders: {
    "HTTP-Referer": "https://cricscore.venkateshsingamsetty.com",
    "X-Title": "CricScore",
  },
});

/**
 * Returns the default model name based on the configured LLM provider.
 */
function getDefaultModel() {
  const url = (baseURL || "").toLowerCase();
  if (url.includes("groq")) return "llama-3.3-70b-versatile";
  if (url.includes("openrouter")) return "openai/gpt-4o-mini";
  return "gpt-4o-mini";
}

/**
 * The LLM model to use — can be overridden via LLM_MODEL env var.
 */
const LLM_MODEL = process.env.LLM_MODEL || getDefaultModel();

/**
 * Returns the default embedding model name based on provider.
 */
function getDefaultEmbeddingModel() {
  const url = (baseURL || "").toLowerCase();
  if (url.includes("openrouter")) return "openai/text-embedding-3-small";
  return "text-embedding-3-small";
}

/**
 * The base URL and model for generating vector embeddings.
 */
const EMBEDDING_BASE_URL = baseURL;
const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || getDefaultEmbeddingModel();

module.exports = { openai, LLM_MODEL, EMBEDDING_BASE_URL, EMBEDDING_MODEL };
