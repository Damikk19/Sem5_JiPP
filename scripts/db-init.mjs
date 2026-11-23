// Tworzy tabelę z db/schema.sql. Uruchomienie: npm run db:init (czyta .env.local).
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Brak DATABASE_URL w .env.local");
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const statements = schema
  .split(";")
  .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}
console.log(`OK, wykonano ${statements.length} polecenia z db/schema.sql`);
