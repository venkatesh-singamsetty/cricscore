const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL + "?sslmode=require",
});

async function query() {
  const client = await pool.connect();
  try {
    const res = await client.query(
      "SELECT chunk_text FROM tournament_rules WHERE chunk_text ILIKE '%powerplay%' LIMIT 5;",
    );
    console.log(res.rows);
  } finally {
    client.release();
    pool.end();
  }
}
query().catch(console.error);
