import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";
import { seed } from "./seed";

type Row = Record<string, unknown>;
type Param = string | number | bigint | null | Uint8Array;

declare global {
  // eslint-disable-next-line no-var
  var __medtwentyDb: DatabaseSync | undefined;
}

function open(): DatabaseSync {
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "medtwenty.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  const seeded = db.prepare("SELECT value FROM site_settings WHERE key = 'seeded'").get() as Row | undefined;
  if (!seeded) {
    db.exec("BEGIN");
    try {
      seed(db);
      db.prepare("INSERT INTO site_settings (key, value) VALUES ('seeded', '1')").run();
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return db;
}

export function db(): DatabaseSync {
  if (!globalThis.__medtwentyDb) globalThis.__medtwentyDb = open();
  return globalThis.__medtwentyDb;
}

function clean(params: unknown[]): Param[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === "boolean") return p ? 1 : 0;
    return p as Param;
  });
}

export function all<T = Row>(sql: string, ...params: unknown[]): T[] {
  // node:sqlite returns null-prototype objects; React needs plain ones.
  return db().prepare(sql).all(...clean(params)).map((r) => ({ ...r })) as T[];
}

export function get<T = Row>(sql: string, ...params: unknown[]): T | undefined {
  const r = db().prepare(sql).get(...clean(params));
  return (r ? { ...r } : undefined) as T | undefined;
}

export function run(sql: string, ...params: unknown[]) {
  const r = db().prepare(sql).run(...clean(params));
  return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) };
}

export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN");
  try {
    const out = fn();
    d.exec("COMMIT");
    return out;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

export function scalar<T = number>(sql: string, ...params: unknown[]): T {
  const row = get<Row>(sql, ...params);
  return (row ? Object.values(row)[0] : null) as T;
}
