const { pool, setSearchPath } = require("../../config/db");

/**
 * MCP Tool: execute_sql
 *
 * Executes a READ-ONLY SQL query against the CricScore PostgreSQL database.
 * Runs inside a READ ONLY transaction with a 3-second statement timeout
 * to prevent runaway queries.
 *
 * Security: The LLM only provides the query string — it never sees credentials.
 * All connection details are encapsulated inside this MCP tool.
 *
 * @param {object} args
 * @param {string} args.query - The SELECT SQL query to execute
 * @returns {object} MCP content response
 */
async function executeSqlTool({ query }) {
  console.log("MCP Tool [execute_sql] query:", query);
  let queryResult = "";

  try {
    const client = await pool.connect();
    try {
      await setSearchPath(client);
      await client.query("BEGIN READ ONLY;");
      await client.query("SET statement_timeout = 3000;"); // 3s hard limit
      const res = await client.query(query);
      queryResult = JSON.stringify(res.rows).slice(0, 25000); // Truncate for LLM context, increased from 2000 to handle more matches
      await client.query("COMMIT;");
    } catch (err) {
      await client.query("ROLLBACK;");
      console.error("MCP Tool [execute_sql] error:", err);
      queryResult = "Error executing SQL: " + err.message;
    } finally {
      client.release();
    }
  } catch (err) {
    queryResult = "Failed to connect to database.";
  }

  return {
    content: [{ type: "text", text: queryResult || "No results found." }],
  };
}

module.exports = { executeSqlTool };
