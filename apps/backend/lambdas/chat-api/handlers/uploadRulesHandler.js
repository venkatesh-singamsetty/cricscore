// Polyfills required by pdf-parse / pdf.js in Node.js Lambda environments.
// pdf.js internally references browser canvas APIs — these stubs prevent crashes.
global.DOMMatrix = global.DOMMatrix || class DOMMatrix {};
global.ImageData = global.ImageData || class ImageData {};
global.Path2D = global.Path2D || class Path2D {};

const { PDFParse } = require("pdf-parse");
const { pool, setSearchPath } = require("../config/db");
const { EMBEDDING_BASE_URL, EMBEDDING_MODEL } = require("../config/llm");

/**
 * Handles POST /rules/upload
 *
 * Accepts a Base64-encoded PDF, extracts text, chunks it, generates
 * vector embeddings via OpenRouter, and stores the results in the
 * environment-scoped `tournament_rules` pgvector table.
 *
 * Implementation notes:
 * - Uses native fetch (not OpenAI SDK) for embeddings to avoid
 *   ERR_STREAM_PREMATURE_CLOSE when using OpenRouter as provider.
 * - Sends all chunks in a single batched embedding request to avoid
 *   hitting API Gateway's 30-second integration timeout.
 * - Requires Lambda memory >= 512 MB to parse large PDFs without OOM.
 *   (Currently configured to 1024 MB in infra/terraform/lambda.tf)
 *
 * @param {object} event - API Gateway Lambda event
 * @param {object} corsHeaders - CORS headers to include in response
 * @returns {object} Lambda response with chunk count or error
 */
async function uploadRulesHandler(event, corsHeaders) {
  try {
    const body = JSON.parse(event.body || "{}");
    const { fileBase64, fileName = "rulebook.pdf" } = body;

    if (!fileBase64) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "No PDF file provided" }),
      };
    }

    // Step 1: Decode Base64 PDF and extract raw text
    const pdfBuffer = Buffer.from(
      fileBase64.split(",")[1] || fileBase64,
      "base64",
    );
    const parser = new PDFParse({ data: pdfBuffer });
    const data = await parser.getText();
    const fullText = data.text;

    // Step 2: Chunk text by paragraphs (double newline), sub-chunk if > 2000 chars
    const rawChunks = fullText
      .split(/\n\s*\n/)
      .filter((c) => c.trim().length > 10);
    const chunks = [];
    for (const chunk of rawChunks) {
      if (chunk.length > 2000) {
        const subChunks = chunk.match(/.{1,1500}/g) || [];
        chunks.push(...subChunks);
      } else {
        chunks.push(chunk);
      }
    }

    const validChunks = chunks.filter((c) => c.trim().length > 0);
    let insertedCount = 0;

    const client = await pool.connect();
    try {
      await setSearchPath(client);

      // Step 3: Clear previous chunks for THIS specific document
      await client.query(
        "DELETE FROM tournament_rules WHERE document_name = $1",
        [fileName],
      );

      if (validChunks.length > 0) {
        // Step 4: Batch embed all chunks in a single API call (avoids 30s timeout)
        const embeddingRes = await fetch(`${EMBEDDING_BASE_URL}/embeddings`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.LLM_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: EMBEDDING_MODEL,
            input: validChunks,
          }),
        });

        if (!embeddingRes.ok) {
          const errText = await embeddingRes.text();
          throw new Error(
            `Embedding API Error: ${embeddingRes.status} - ${errText}`,
          );
        }

        const embeddingData = await embeddingRes.json();

        // Step 5: Insert each chunk with its embedding vector and document name
        for (let i = 0; i < validChunks.length; i++) {
          const chunk = validChunks[i];
          const embedding = embeddingData.data[i].embedding;
          const embeddingVectorString = `[${embedding.join(",")}]`;

          await client.query(
            "INSERT INTO tournament_rules (chunk_text, embedding, document_name) VALUES ($1, $2, $3)",
            [chunk, embeddingVectorString, fileName],
          );
          insertedCount++;
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "Rules successfully parsed and embedded",
          chunksProcessed: insertedCount,
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("uploadRulesHandler error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Failed to process PDF" }),
    };
  }
}

module.exports = { uploadRulesHandler };
