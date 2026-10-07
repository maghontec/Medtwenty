import { NextResponse } from "next/server";
import { authorize, readJson, validate, type Schema } from "@/lib/ingest";
import { get, run } from "@/lib/db";
import { notifyEditor } from "@/lib/email";
import { appUrl } from "@/lib/settings";

const BODY: Schema = {
  external_id: { type: "string", required: true, max: 200 },
  extracted_item_id: { type: "integer", required: true },
  headline: { type: "string", required: true, max: 300 },
  standfirst: { type: "string", max: 600 },
  body_markdown: { type: "string", required: true, max: 60000 },
  why_it_matters: { type: "string", max: 2000 },
  suggested_topics: { type: "array", max: 20 },
  seo_title: { type: "string", max: 120 },
  seo_description: { type: "string", max: 300 },
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

  const marker = `draft:${body.external_id}`;
  const dup = get<{ entity_id: string }>("SELECT entity_id FROM audit_log WHERE action = 'ingest_draft' AND after_json = ?", JSON.stringify({ marker }));
  if (dup) return NextResponse.json({ status: "duplicate", article_id: Number(dup.entity_id) });

  const item = get<{ id: number; article_id: number | null }>("SELECT id, article_id FROM extracted_items WHERE id = ?", body.extracted_item_id);
  if (!item) return NextResponse.json({ error: "Unknown extracted_item_id" }, { status: 404 });
  if (!item.article_id) return NextResponse.json({ error: "No draft exists for this item. Press Write story in the Shortlist first." }, { status: 409 });
  const a = get<{ id: number; status: string }>("SELECT id, status FROM articles WHERE id = ?", item.article_id);
  if (!a) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (a.status !== "draft") return NextResponse.json({ error: "The piece is no longer a draft; not overwritten." }, { status: 409 });

  // Fills the draft; it stays a draft. Nothing is ever published automatically.
  run(
    `UPDATE articles SET headline = ?, standfirst = ?, body = ?, why_it_matters = COALESCE(?, why_it_matters), topics = ?, seo_title = ?, seo_description = ?, updated_at = ? WHERE id = ? AND status = 'draft'`,
    body.headline, body.standfirst ?? null, body.body_markdown, body.why_it_matters ?? null,
    Array.isArray(body.suggested_topics) ? (body.suggested_topics as string[]).join(", ") : null,
    body.seo_title ?? null, body.seo_description ?? null, new Date().toISOString(), a.id,
  );
  run("INSERT INTO audit_log (actor_email, action, entity, entity_id, after_json) VALUES ('n8n', 'ingest_draft', 'article', ?, ?)", String(a.id), JSON.stringify({ marker }));
  await notifyEditor("A draft is ready to edit", String(body.headline), `${appUrl()}/admin/articles/${a.id}`);
  return NextResponse.json({ status: "filled", article_id: a.id });
}
