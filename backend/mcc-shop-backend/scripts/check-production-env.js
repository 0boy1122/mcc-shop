require("dotenv").config({ path: ".env.production.local" });
require("dotenv").config();

const required = [
  "DATABASE_URL",
  "JWT_SECRET",
];

const hasStaffPassword = Boolean(process.env.STAFF_PASSWORD || process.env.ADMIN_PASSWORD);
const missing = required.filter((key) => !process.env[key]);

if (!hasStaffPassword) {
  missing.push("STAFF_PASSWORD or ADMIN_PASSWORD");
}

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("postgresql://")) {
  console.error("DATABASE_URL must be a PostgreSQL connection string for production.");
  process.exit(1);
}

if (missing.length) {
  console.error(`Missing production env vars: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Production env check passed.");
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.warn("BLOB_READ_WRITE_TOKEN is not set. Product images under 2MB will be stored inline in Postgres.");
}
