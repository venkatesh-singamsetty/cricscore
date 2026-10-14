const { pool } = require("../../config/db");

/**
 * Tool to delete all incomplete matches from the database.
 * Does not require any parameters.
 */
async function deleteIncompleteMatchesTool(args) {
  try {
    const client = await pool.connect();
    let count = 0;
    try {
      const res = await client.query(
        "DELETE FROM matches WHERE status != 'COMPLETED' AND status != 'ABANDONED' RETURNING id",
      );
      count = res.rowCount || 0;
    } finally {
      client.release();
    }

    return {
      content: [
        {
          type: "text",
          text: `Success: Deleted ${count} incomplete matches from the database.`,
        },
      ],
    };
  } catch (err) {
    console.error("deleteIncompleteMatches error:", err);
    return {
      content: [
        {
          type: "text",
          text: `Error executing tool: ${err.message}`,
        },
      ],
      isError: true,
    };
  }
}

module.exports = { deleteIncompleteMatchesTool };
