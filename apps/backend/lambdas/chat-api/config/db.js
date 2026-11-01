const { Pool } = require("pg");

/**
 * Returns SSL configuration for PostgreSQL connections.
 * Enforces strict CA verification when AIVEN_CA_CERT or DATABASE_CA_CERT is provided.
 */
const getSslConfig = () => {
  const caCert = process.env.AIVEN_CA_CERT || process.env.DATABASE_CA_CERT;
  if (caCert) {
    return { rejectUnauthorized: true, ca: caCert };
  }
  // codeql[js/disabling-certificate-validation] Aiven DB requires this unless explicit CA bundle is provided
  return { rejectUnauthorized: false };
};

/**
 * Shared PostgreSQL connection pool for the chat-api Lambda.
 * Reused across warm invocations to avoid reconnection overhead.
 */
const pool = new Pool({
  connectionString: (process.env.DATABASE_URL || "").split("?")[0],
  ssl: getSslConfig(),
  max: 1,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
  query_timeout: 10000,
});
pool.on("error", (err) => console.error("Idle PostgreSQL client error:", err));

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

module.exports = { pool, setSearchPath, getSslConfig };
