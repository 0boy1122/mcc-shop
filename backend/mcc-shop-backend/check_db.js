const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function checkDB() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to Supabase!");
    const res = await client.query('SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = \'public\'');
    console.log("Tables in public schema:", res.rows.map(r => r.tablename));
    await client.end();
  } catch (err) {
    console.error("Connection error:", err.message);
    process.exit(1);
  }
}

checkDB();
