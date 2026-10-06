const { z } = require("zod");

/**
 * Tool to delete all incomplete matches from the database.
 * Does not require any parameters.
 */
async function deleteIncompleteMatchesTool(args, extra) {
  try {
    const { pool } = extra;

    const res = await pool.query(
      "DELETE FROM matches WHERE status != 'COMPLETED' AND status != 'ABANDONED' RETURNING id",
    );

    const count = res.rowCount || 0;
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
