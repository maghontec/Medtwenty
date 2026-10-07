import { NextResponse } from "next/server";
import { authorize, readJson, validate, type Schema } from "@/lib/ingest";
import { get, run } from "@/lib/db";

const SOURCE: Schema = { source_id: { type: "integer", required: true }, items: { type: "integer", min: 0 }, error: { type: "string", max: 2000 } };
const BODY: Schema = {
  external_id: { type: "string", required: true, max: 200 },
  status: { type: "string", required: true, enum: ["running", "finished", "failed"] },
  started_at: { type: "string", max: 40 },
  finished_at: { type: "string", max: 40 },
  sources: { type: "array", of: SOURCE, max: 500 },
  errors: { type: "array", max: 200 },
};

export async function POST(req: Request) {
  const denied = authorize(req);
  if (denied) return denied;
  let body: Record<string, unknown>;
  try {
    body = (await readJson(req)) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const errors = validate(body, BODY);
  if (errors.length) return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });

  const sources = (body.sources as { source_id: number; items?: number; error?: string }[] | undefined) || [];
  const errs = [...((body.errors as string[]) || []), ...sources.filter((s) => s.error).map((s) => ({ source_id: s.source_id, error: s.error }))];
  const counts = JSON.stringify(Object.fromEntries(sources.map((s) => [s.source_id, s.items ?? 0])));
  const now = new Date().toISOString();
  const existing = get<{ id: number }>("SELECT id FROM ingestion_runs WHERE external_id = ?", body.external_id);
  if (existing) {
    run("UPDATE ingestion_runs SET status = ?, finished_at = ?, counts = ?, errors = ? WHERE id = ?", body.status, body.finished_at || (body.status === "running" ? null : now), counts, JSON.stringify(errs), existing.id);
  } else {
    run("INSERT INTO ingestion_runs (external_id, status, started_at, finished_at, counts, errors) VALUES (?, ?, ?, ?, ?, ?)", body.external_id, body.status, body.started_at || now, body.finished_at || null, counts, JSON.stringify(errs));
  }
  if (body.status !== "running") {
    for (const s of sources) {
      if (s.error) run("UPDATE sources SET last_checked_at = ?, last_error = ?, items_last_run = ? WHERE id = ?", now, s.error, s.items ?? 0, s.source_id);
      else run("UPDATE sources SET last_checked_at = ?, last_success_at = ?, last_error = NULL, items_last_run = ? WHERE id = ?", now, now, s.items ?? 0, s.source_id);
    }
  }
  return NextResponse.json({ status: "ok" });
}
