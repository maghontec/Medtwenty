// Deletes the local SQLite database. It is recreated with sample data on the next request.
import fs from "node:fs";
import path from "node:path";
const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "medtwenty.db");
for (const f of [file, `${file}-wal`, `${file}-shm`]) if (fs.existsSync(f)) fs.rmSync(f);
console.log("Database reset:", file);
