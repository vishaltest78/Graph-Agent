import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "../data/graph.db");

fs.mkdirSync(path.join(__dirname, "../data"), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

export function initDb() {
  // Just verify tables exist, ingest.js creates them
  const tables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table'`
  ).all().map(r => r.name);

  if (tables.length === 0) {
    console.warn("Database is empty. Run: npm run ingest");
  } else {
    console.log(`DB ready. Tables: ${tables.join(", ")}`);
  }
}
