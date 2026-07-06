const { pool, setSearchPath } = require("../config/db");

async function listRulesHandler(event, corsHeaders) {
  try {
    const client = await pool.connect();
    try {
      await setSearchPath(client);
      const res = await client.query(
        "SELECT DISTINCT document_name FROM tournament_rules",
      );
      const documents = res.rows.map((r) => r.document_name);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ documents }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("listRulesHandler error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Failed to list documents" }),
    };
  }
}

module.exports = { listRulesHandler };
