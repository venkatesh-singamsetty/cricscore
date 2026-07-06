const { Client } = require("pg");

async function migrate() {
  const client = new Client({
    connectionString:
      "postgres://avnadmin:AVNS_wzjK8g56LJXN1zpqHiI@cricscore-db-venky-cric-score.b.aivencloud.com:17727/defaultdb",
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("Connected to DB.");
    await client.query(
      "ALTER TABLE matches ADD COLUMN IF NOT EXISTS scorer_email VARCHAR(255);",
    );
    console.log("Migration successful: scorer_email added to matches.");
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    await client.end();
  }
}

migrate();
