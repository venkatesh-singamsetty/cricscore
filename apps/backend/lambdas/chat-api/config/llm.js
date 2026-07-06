const { OpenAI } = require("openai");

/**
 * Shared LLM client configuration.
 * Supports OpenRouter (default), Groq, or any OpenAI-compatible provider
 * via LLM_BASE_URL and LLM_API_KEY environment variables.
 */
const openai = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: process.env.LLM_BASE_URL || "https://api.openai.com/v1",
});

/**
 * Returns the default model name based on the configured LLM provider.
 * Falls back to gpt-4o-mini for OpenRouter (fast, cost-effective, reliable).
 */
function getDefaultModel() {
  const baseURL = process.env.LLM_BASE_URL || "";
  if (baseURL.includes("groq")) return "llama-3.3-70b-versatile";
  return "gpt-4o-mini";
}

/**
 * The LLM model to use — can be overridden via LLM_MODEL env var.
 * Defaults to gpt-4o-mini (OpenRouter) or llama-3.3-70b-versatile (Groq).
 */
const LLM_MODEL = process.env.LLM_MODEL || getDefaultModel();

/**
 * The base URL for generating vector embeddings.
 * Uses native fetch (not OpenAI SDK) to avoid ERR_STREAM_PREMATURE_CLOSE
 * when using OpenRouter as the embedding provider.
 */
const EMBEDDING_BASE_URL =
  process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

module.exports = { openai, LLM_MODEL, EMBEDDING_BASE_URL, EMBEDDING_MODEL };
