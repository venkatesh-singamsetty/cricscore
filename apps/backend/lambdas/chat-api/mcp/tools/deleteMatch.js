const { pool } = require("../../config/db");

/**
 * Tool to delete a specific match from the database.
 */
async function deleteMatchTool(args) {
  try {
    const { match_id } = args;
    if (!match_id) {
      throw new Error("match_id is required");
    }

    const client = await pool.connect();
    let count = 0;
    try {
      const res = await client.query(
        "DELETE FROM matches WHERE id = $1 RETURNING id",
        [match_id],
      );
      count = res.rowCount || 0;
    } finally {
      client.release();
    }

    return {
      content: [
        {
          type: "text",
          text:
            count > 0
              ? `Success: Deleted match ${match_id} from the database.`
              : `Error: No match found with id ${match_id}.`,
        },
      ],
    };
  } catch (err) {
    console.error("deleteMatchTool error:", err);
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

module.exports = { deleteMatchTool };
