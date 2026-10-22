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
const FORBIDDEN_SQL =
  /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|do|set|reset|pg_sleep|pg_read_file|pg_ls_dir|lo_import|lo_export|dblink|scorer_email)\b/i;

/**
 * Defense in depth on top of BEGIN READ ONLY: single SELECT/WITH statement only.
 * @returns {string|null} error message, or null when the query is acceptable
 */
function validateReadOnlySql(query) {
  if (typeof query !== "string" || !query.trim()) return "Query is required.";
  const q = query.trim().replace(/;+\s*$/, "");
  if (q.includes(";")) return "Only a single statement is allowed.";
  if (!/^(select|with)\b/i.test(q)) return "Only SELECT queries are allowed.";
  if (FORBIDDEN_SQL.test(q)) return "Query contains a forbidden keyword.";
  return null;
}

async function executeSqlTool({ query }) {
  const invalid = validateReadOnlySql(query);
  if (invalid) {
    return {
      content: [{ type: "text", text: "Error executing SQL: " + invalid }],
    };
  }
  console.log("MCP Tool [execute_sql] query:", query);
  let queryResult = "";

  try {
    const client = await pool.connect();
    try {
      await setSearchPath(client);
      await client.query("BEGIN READ ONLY;");
      await client.query("SET statement_timeout = 3000;"); // 3s hard limit
      const res = await client.query(query);
      const safeRows = Array.isArray(res.rows)
        ? res.rows.map((row) => {
            if (row && typeof row === "object" && "scorer_email" in row) {
              const { scorer_email, ...rest } = row;
              return rest;
            }
            return row;
          })
        : res.rows;
      queryResult = JSON.stringify(safeRows).slice(0, 25000); // Truncate for LLM context, increased from 2000 to handle more matches
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

module.exports = { executeSqlTool, validateReadOnlySql };
