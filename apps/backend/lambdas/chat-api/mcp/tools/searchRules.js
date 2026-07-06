const { pool, setSearchPath } = require("../../config/db");
const { EMBEDDING_BASE_URL, EMBEDDING_MODEL } = require("../../config/llm");

/**
 * MCP Tool: search_tournament_rules
 *
 * Performs a cosine-similarity vector search against the tournament_rules
 * pgvector table to retrieve the most semantically relevant rule chunks
 * from the uploaded PDF rulebook.
 *
 * Implementation notes:
 * - Uses native fetch (NOT the OpenAI SDK) to avoid ERR_STREAM_PREMATURE_CLOSE
 *   when OpenRouter is used as the embedding provider.
 * - Casts the embedding as `public.vector` to ensure the pgvector <=> operator
 *   is found even when search_path is set to a non-public schema (dev/prod).
 * - search_path is always set to `${dbSchema}, public` so pgvector operators
 *   remain visible alongside the scoped schema tables.
 *
 * @param {object} args
 * @param {string} args.query - Natural language query to search the rulebook
 * @returns {object} MCP content response with top 3 matching rule chunks
 */
async function searchRulesTool({ query }) {
  console.log("MCP Tool [search_tournament_rules] query:", query);
  let searchResult = "";

  try {
    // Step 1: Generate embedding via native fetch (OpenRouter-compatible)
    const embeddingReq = await fetch(`${EMBEDDING_BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: query,
      }),
    });

    if (!embeddingReq.ok) throw new Error("Embedding API failed");

    const embeddingRes = await embeddingReq.json();
    const embedding = embeddingRes.data[0].embedding;
    const embeddingVectorString = `[${embedding.join(",")}]`;

    // Step 2: Cosine similarity search via pgvector
    const client = await pool.connect();
    try {
      await setSearchPath(client); // Includes public for pgvector operator visibility
      const res = await client.query(
        // Cast to public.vector explicitly to resolve <=> operator
        // regardless of which schema (dev/prod) is the active search_path
        "SELECT chunk_text, document_name FROM tournament_rules ORDER BY embedding <=> $1::public.vector LIMIT 3",
        [embeddingVectorString],
      );

      if (res.rows.length > 0) {
        searchResult = res.rows
          .map((r) => `[Source: ${r.document_name}]\n${r.chunk_text}`)
          .join("\n\n---\n\n");
      } else {
        searchResult =
          "No rules document has been uploaded yet, or no relevant rules found.";
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("MCP Tool [search_tournament_rules] error:", err);
    searchResult = "Error searching rules: " + err.message;
  }

  return {
    content: [{ type: "text", text: searchResult }],
  };
}

module.exports = { searchRulesTool };
