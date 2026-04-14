require("dotenv").config({ path: require("path").join(__dirname, "..", "..", ".env") });
const { Client } = require("pg");

async function run() {
  const client = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE
  });

  try {
    await client.connect();
    const now = await client.query("SELECT NOW() AS now");
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name ASC
    `);
    console.log("PostgreSQL connection: OK");
    console.log("Server time:", now.rows[0]?.now);
    console.log("Public tables:", tables.rows.map((x) => x.table_name).join(", ") || "(none)");
  } catch (error) {
    console.error("PostgreSQL connection failed:", error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

run();
