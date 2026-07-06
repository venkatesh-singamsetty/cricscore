const { Pool } = require("pg");

/**
 * Shared PostgreSQL connection pool for the chat-api Lambda.
 * Reused across warm invocations to avoid reconnection overhead.
 */
const pool = new Pool({
  connectionString: (process.env.DATABASE_URL || "").split("?")[0],
  ssl: { rejectUnauthorized: false }, // Required for Aiven managed PostgreSQL
});

/**
 * Sets the PostgreSQL search_path for a client connection.
 * Always appends 'public' so pgvector operators (<=> etc.) remain visible
 * regardless of which environment schema (dev/prod) is active.
 *
 * @param {import('pg').PoolClient} client
 */
async function setSearchPath(client) {
  const dbSchema = process.env.DB_SCHEMA || "public";
  await client.query(`SET search_path TO ${dbSchema}, public`);
}

module.exports = { pool, setSearchPath };
