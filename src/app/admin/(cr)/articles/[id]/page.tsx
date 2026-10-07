import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { all, get } from "@/lib/db";
import { activeCategories, articleById } from "@/lib/content";
import { publishChecklist } from "@/lib/editorial";
import { articleStatusAction, entityLinkAction, factAction, restoreVersionAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/time";
import { Badge, Flash, Panel } from "../../ui";
import { Editor } from "./Editor";

export const metadata = { title: "Article editor" };

function imageLibrary(): string[] {
  try {
    const dir = path.join(process.cwd(), "public", "images", "stories");
    return fs.readdirSync(dir).filter((f) => /\.(webp|jpe?g|png|avif)$/i.test(f)).map((f) => `/images/stories/${f}`);
  } catch {
    return [];
  }
}

export default async function ArticleEditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const staff = await requireStaff();
  const id = Number((await params).id);
  const a = articleById(id);
  if (!a) notFound();
  const sp = await searchParams;
  const canPublish = staff.roles.some((r) => r === "super_admin" || r === "editor");
  const facts = all<{ id: number; label: string; value: string; status: string; provenance: string | null; kind: string }>("SELECT * FROM facts WHERE article_id = ? ORDER BY id", id);
  const companies = all<{ id: number; name: string; is_stub: number }>("SELECT c.id, c.name, c.is_stub FROM companies c JOIN article_entities e ON e.entity_id = c.id AND e.entity_type = 'company' WHERE e.article_id = ?", id);
  const deals = all<{ id: number; acquirer: string | null; target: string; value_text: string | null; verified: number }>(
    "SELECT d.* FROM deals d WHERE d.article_id = ? OR d.id IN (SELECT entity_id FROM article_entities WHERE article_id = ? AND entity_type = 'deal')",
    id,
    id,
  );
  const decisions = all<{ id: number; product: string; regulator: string; verified: number }>(
    "SELECT r.* FROM regulatory_decisions r WHERE r.article_id = ? OR r.id IN (SELECT entity_id FROM article_entities WHERE article_id = ? AND entity_type = 'regulatory')",
    id,
    id,
  );
  const allCompanies = all<{ id: number; name: string }>("SELECT id, name FROM companies ORDER BY name");
  const versions = all<{ id: number; created_at: string; email: string | null }>(
    "SELECT v.id, v.created_at, u.email FROM article_versions v LEFT JOIN users u ON u.id = v.created_by WHERE v.article_id = ? ORDER BY v.id DESC LIMIT 20",
    id,
  );
  const candidate = a.candidate_id ? get<{ ai_summary: string | null; note: string | null }>("SELECT ai_summary, note FROM extracted_items WHERE id = ?", a.candidate_id) : undefined;
  const checklist = publishChecklist(a);
  const unverified = facts.filter((f) => f.status === "unverified").length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/admin/pipeline" className="text-sm underline">← Pipeline</Link>
        <Badge s={a.status} />
        {a.published_at && <span className="text-xs text-muted">Published {formatDateTime(a.published_at)}</span>}
        {a.status === "published" && <Link href={`/news/${a.slug}`} target="_blank" className="text-xs underline">View live</Link>}
      </div>
      <Flash sp={sp} />
      {a.review_note && <p className="mb-4 rounded bg-[#fdf0d5] px-4 py-2 text-sm">Note: {a.review_note}</p>}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Editor
          id={a.id}
          status={a.status}
          canPublish={canPublish}
          checklist={checklist}
          publicUrl={`/news/${a.slug}`}
          categories={activeCategories().map((c) => ({ id: c.id, name: c.name }))}
          library={imageLibrary()}
          initial={{
            headline: a.headline,
            standfirst: a.standfirst || "",
            body: a.body,
            why_it_matters: a.why_it_matters || "",
            source_outlet: a.source_outlet || "",
            source_url: a.source_url || "",
            content_type: a.content_type,
            category_id: a.category_id ? String(a.category_id) : "",
            topics: a.topics || "",
            is_premium: !!a.is_premium,
            is_editors_pick: !!a.is_editors_pick,
            seo_title: a.seo_title || "",
            seo_description: a.seo_description || "",
            slug: a.slug,
            editorial_minutes: a.editorial_minutes || 0,
            hero_image_url: a.hero_image_url || "",
            hero_alt: a.hero_alt || "",
            author_name: a.author_name || "",
            send_daily: !!a.send_daily,
          }}
        />

        <div className="space-y-5">
          <Panel title="Publish checklist">
            <ul className="space-y-1.5 text-sm">
              {checklist.map((c) => (
                <li key={c.label} className={c.ok ? "text-up" : "text-down"}>
                  {c.ok ? "✓" : "✗"} {c.label}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">Checklist reflects the last save.</p>
          </Panel>

          <Panel title="Original source">
            {a.source_url ? (
              <>
                <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="break-all text-sm font-semibold text-rust-text underline">{a.source_url}</a>
                <iframe src={a.source_url} title="Original source" sandbox="" referrerPolicy="no-referrer" className="mt-3 h-72 w-full rounded border border-line bg-white" />
                <p className="mt-1 text-xs text-muted">Many sites block embedding; use the link if the frame is blank.</p>
              </>
            ) : (
              <p className="text-sm text-muted">No source URL yet.</p>
            )}
            {candidate?.ai_summary && <p className="mt-3 text-sm"><span className="font-semibold">Pipeline summary:</span> {candidate.ai_summary}</p>}
            {candidate?.note && <p className="mt-1 text-sm italic text-muted">{candidate.note}</p>}
          </Panel>

          <Panel title={`Facts · ${unverified} unverified`} actions={unverified > 0 ? (
            <form action={factAction}><input type="hidden" name="article_id" value={id} /><input type="hidden" name="op" value="verify_all" /><button className="text-xs underline">Verify all</button></form>
          ) : undefined}>
            <div id="facts" />
            <ul className="space-y-3">
              {facts.map((f) => (
                <li key={f.id} className="rounded border border-line p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{f.label}</span>
                    <Badge s={f.status === "verified" ? "published" : f.status === "rejected" ? "rejected" : "review"} />
                  </div>
                  <form action={factAction} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="article_id" value={id} />
                    <input type="hidden" name="id" value={f.id} />
                    <input name="value" defaultValue={f.value} className="input min-w-0 flex-1 py-1 text-sm" aria-label={`${f.label} value`} />
                    <button name="op" value="verify" className="btn btn-primary btn-sm">Verify</button>
                    <button name="op" value="edit" className="btn btn-outline btn-sm">Edit</button>
                    <button name="op" value="reject" className="btn btn-outline btn-sm">Reject</button>
                  </form>
                  {f.provenance && <p className="mt-1 text-xs text-muted">From: {f.provenance}</p>}
                </li>
              ))}
            </ul>
            <form action={factAction} className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
              <input type="hidden" name="article_id" value={id} />
              <input type="hidden" name="op" value="add" />
              <input name="label" placeholder="Fact (e.g. Deal value)" className="input py-1.5 text-sm" aria-label="Fact label" required />
              <input name="value" placeholder="Value" className="input py-1.5 text-sm" aria-label="Fact value" required />
              <button className="btn btn-dark btn-sm">Add</button>
            </form>
          </Panel>

          <Panel title="Related entities">
            <div id="entities" />
            <p className="eyebrow text-[0.62rem] text-muted">Companies</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {companies.map((c) => (
                <li key={c.id}>
                  <form action={entityLinkAction} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-sm">
                    <input type="hidden" name="article_id" value={id} />
                    <input type="hidden" name="entity_type" value="company" />
                    <input type="hidden" name="entity_id" value={c.id} />
                    {c.name}{c.is_stub ? " (stub)" : ""}
                    <button name="op" value="unlink" aria-label={`Unlink ${c.name}`} className="ml-1 text-muted">×</button>
                  </form>
                </li>
              ))}
            </ul>
            <form action={entityLinkAction} className="mt-3 flex gap-2">
              <input type="hidden" name="article_id" value={id} />
              <input type="hidden" name="entity_type" value="company" />
              <select name="entity_id" className="input py-1.5 text-sm" aria-label="Company">
                {allCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button name="op" value="link" className="btn btn-outline btn-sm">Link</button>
            </form>
            <form action={entityLinkAction} className="mt-2 flex gap-2">
              <input type="hidden" name="article_id" value={id} />
              <input type="hidden" name="entity_type" value="company" />
              <input name="name" placeholder="New company name" className="input py-1.5 text-sm" aria-label="New company" />
              <button name="op" value="create_company" className="btn btn-outline btn-sm whitespace-nowrap">Create new</button>
            </form>

            <p className="eyebrow mt-5 text-[0.62rem] text-muted">Deals</p>
            <ul className="mt-1 text-sm">
              {deals.map((d) => <li key={d.id}>{d.acquirer ? `${d.acquirer} → ` : ""}{d.target} · {d.value_text || "Undisclosed"} {d.verified ? "" : <span className="text-xs text-muted">(unverified until publish)</span>}</li>)}
            </ul>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer underline">Create deal</summary>
              <form action={entityLinkAction} className="mt-2 grid grid-cols-2 gap-2">
                <input type="hidden" name="article_id" value={id} />
                <input type="hidden" name="entity_type" value="deal" />
                <select name="deal_type" className="input py-1.5 text-sm" aria-label="Deal type"><option value="acquisition">Acquisition</option><option value="funding">Funding</option><option value="restructuring">Restructuring</option></select>
                <select name="status" className="input py-1.5 text-sm" aria-label="Status"><option>announced</option><option>closed</option><option>rumoured</option></select>
                <input name="acquirer" placeholder="Acquirer / lead (optional)" className="input py-1.5 text-sm" aria-label="Acquirer" />
                <input name="target" placeholder="Target / company" required className="input py-1.5 text-sm" aria-label="Target" />
                <input name="value_text" placeholder="Value (e.g. $1.5bn)" className="input py-1.5 text-sm" aria-label="Value" />
                <input name="round" placeholder="Round (e.g. Series B)" className="input py-1.5 text-sm" aria-label="Round" />
                <input name="sector" placeholder="Sector" className="input py-1.5 text-sm" aria-label="Sector" />
                <button name="op" value="create_deal" className="btn btn-outline btn-sm">Create and link</button>
              </form>
            </details>

            <p className="eyebrow mt-5 text-[0.62rem] text-muted">Regulatory decisions</p>
            <ul className="mt-1 text-sm">
              {decisions.map((r) => <li key={r.id}>{r.product} · {r.regulator}</li>)}
            </ul>
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer underline">Create decision</summary>
              <form action={entityLinkAction} className="mt-2 grid grid-cols-2 gap-2">
                <input type="hidden" name="article_id" value={id} />
                <input type="hidden" name="entity_type" value="regulatory" />
                <input name="product" placeholder="Product or subject" required className="input py-1.5 text-sm" aria-label="Product" />
                <input name="regulator" placeholder="Regulator" defaultValue="MHRA" className="input py-1.5 text-sm" aria-label="Regulator" />
                <input name="company" placeholder="Company (optional)" className="input py-1.5 text-sm" aria-label="Company" />
                <select name="decision" className="input py-1.5 text-sm" aria-label="Decision"><option>approved</option><option>rejected</option><option>pending</option><option>guidance</option></select>
                <button name="op" value="create_regulatory" className="btn btn-outline btn-sm">Create and link</button>
              </form>
            </details>
          </Panel>

          <Panel title="Workflow">
            <div id="status" />
            <form action={articleStatusAction} className="space-y-3">
              <input type="hidden" name="id" value={id} />
              <textarea name="note" rows={2} placeholder="Note (required to retract; optional when returning or rejecting)" className="input text-sm" aria-label="Note" />
              <div className="flex flex-wrap gap-2">
                {["review", "approved", "scheduled"].includes(a.status) && <button name="op" value="draft" className="btn btn-outline btn-sm">Return to draft</button>}
                {a.status === "review" && canPublish && <button name="op" value="approve" className="btn btn-outline btn-sm">Approve</button>}
                {["draft", "review"].includes(a.status) && <button name="op" value="reject" className="btn btn-outline btn-sm">Reject</button>}
                {a.status === "published" && canPublish && <button name="op" value="retract" className="btn btn-danger btn-sm">Retract (creates correction)</button>}
                {a.status === "published" && canPublish && <button name="op" value="unpublish" className="btn btn-outline btn-sm">Unpublish</button>}
              </div>
              {canPublish && a.status !== "published" && (
                <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
                  <div>
                    <label className="label text-xs" htmlFor="when">Schedule for (UTC)</label>
                    <input id="when" type="datetime-local" name="when" className="input py-1.5 text-sm" />
                  </div>
                  <button name="op" value="schedule" className="btn btn-outline btn-sm">Schedule</button>
                </div>
              )}
            </form>
          </Panel>

          <Panel title="Version history">
            {versions.length === 0 && <p className="text-sm text-muted">Versions are saved when you press Save version, publish or change status.</p>}
            <ul className="space-y-2 text-sm">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2">
                  <span>{formatDateTime(v.created_at)} <span className="text-muted">{v.email || "system"}</span></span>
                  <form action={restoreVersionAction}>
                    <input type="hidden" name="version_id" value={v.id} />
                    <button className="text-xs underline">Restore</button>
                  </form>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
