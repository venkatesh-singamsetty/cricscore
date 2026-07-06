const { pool, setSearchPath } = require("../config/db");

async function deleteRulesHandler(event, corsHeaders) {
  try {
    const documentName = event.queryStringParameters?.documentName;

    if (!documentName) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: "No documentName provided" }),
      };
    }

    const client = await pool.connect();
    try {
      await setSearchPath(client);

      const res = await client.query(
        "DELETE FROM tournament_rules WHERE document_name = $1",
        [documentName],
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: `Successfully deleted document ${documentName}`,
          deletedChunks: res.rowCount,
        }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("deleteRulesHandler error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Failed to delete document" }),
    };
  }
}

module.exports = { deleteRulesHandler };
