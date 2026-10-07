import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { all } from "@/lib/db";
import { activeCategories } from "@/lib/content";
import { articleStatusAction, correctionAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/time";
import { Badge, Flash, PageHead, Panel } from "../ui";

export const metadata = { title: "Story pipeline" };

const STATUSES = ["draft", "review", "approved", "scheduled", "published", "rejected", "retracted"];

type Row = { id: number; headline: string; status: string; content_type: string; category_name: string | null; updated_at: string; published_at: string | null; scheduled_for: string | null; is_premium: number; review_note: string | null; editorial_minutes: number | null };

export default async function Pipeline({ searchParams }: { searchParams: Promise<{ status?: string; type?: string; cat?: string; from?: string; to?: string; tab?: string; msg?: string; err?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  if (sp.tab === "corrections") return <Corrections sp={sp} />;
  const where: string[] = [];
  const p: unknown[] = [];
  if (sp.status) { where.push("a.status = ?"); p.push(sp.status); }
  if (sp.type) { where.push("a.content_type = ?"); p.push(sp.type); }
  if (sp.cat) { where.push("a.category_id = ?"); p.push(Number(sp.cat)); }
  if (sp.from) { where.push("a.updated_at >= ?"); p.push(sp.from); }
  if (sp.to) { where.push("a.updated_at <= ?"); p.push(sp.to + "T23:59:59Z"); }
  const rows = all<Row>(
    `SELECT a.id, a.headline, a.status, a.content_type, c.name AS category_name, a.updated_at, a.published_at, a.scheduled_for, a.is_premium, a.review_note, a.editorial_minutes
     FROM articles a LEFT JOIN categories c ON c.id = a.category_id ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY CASE a.status WHEN 'review' THEN 0 WHEN 'approved' THEN 1 WHEN 'draft' THEN 2 WHEN 'scheduled' THEN 3 ELSE 4 END, a.updated_at DESC LIMIT 300`,
    ...p,
  );
  const counts = Object.fromEntries(all<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM articles GROUP BY status").map((r) => [r.status, r.n]));
  const cats = activeCategories();
  return (
    <>
      <PageHead title="Story pipeline" sub="Draft → In review → Approved → Published" actions={<><Link href="/admin/pipeline?tab=corrections" className="btn btn-outline btn-sm">Corrections</Link><Link href="/admin/articles" className="btn btn-primary btn-sm">New piece</Link></>} />
      <Flash sp={sp} />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link href="/admin/pipeline" className={`rounded-full border px-3 py-1 ${!sp.status ? "border-charcoal bg-charcoal text-white" : "border-line bg-white"}`}>All</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/admin/pipeline?status=${s}`} className={`rounded-full border px-3 py-1 ${sp.status === s ? "border-charcoal bg-charcoal text-white" : "border-line bg-white"}`}>
            {s} ({counts[s] || 0})
          </Link>
        ))}
      </div>
      <form className="mb-4 flex flex-wrap gap-2">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <select name="type" defaultValue={sp.type || ""} className="input w-auto py-1.5 text-sm" aria-label="Content type">
          <option value="">All types</option>
          <option value="story">Stories</option>
          <option value="briefing">Briefings</option>
          <option value="analysis">Analysis</option>
        </select>
        <select name="cat" defaultValue={sp.cat || ""} className="input w-auto py-1.5 text-sm" aria-label="Category">
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" name="from" defaultValue={sp.from} className="input w-auto py-1.5 text-sm" aria-label="From" />
        <input type="date" name="to" defaultValue={sp.to} className="input w-auto py-1.5 text-sm" aria-label="To" />
        <button className="btn btn-outline btn-sm">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table min-w-[900px]">
          <thead>
            <tr><th>Piece</th><th>Status</th><th>Type</th><th>Category</th><th>Updated</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="max-w-md">
                  <Link href={`/admin/articles/${r.id}`} className="font-medium hover:underline">{r.headline}</Link>
                  {!!r.is_premium && <span className="ml-2 text-xs text-rust-text">Premium</span>}
                  {r.review_note && <p className="mt-1 text-xs text-muted">Note: {r.review_note}</p>}
                </td>
                <td><Badge s={r.status} />{r.scheduled_for && r.status === "scheduled" && <p className="mt-1 text-xs text-muted">{formatDateTime(r.scheduled_for)}</p>}</td>
                <td className="text-muted">{r.content_type}</td>
                <td className="text-muted">{r.category_name || "—"}</td>
                <td className="whitespace-nowrap text-muted">{formatDateTime(r.published_at || r.updated_at)}</td>
                <td>
                  <form action={articleStatusAction} className="flex flex-wrap gap-1">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="back" value="/admin/pipeline" />
                    {r.status === "draft" && <button name="op" value="review" className="btn btn-outline btn-sm">Send to review</button>}
                    {r.status === "review" && <button name="op" value="approve" className="btn btn-outline btn-sm">Approve</button>}
                    {["draft", "review", "approved"].includes(r.status) && <button name="op" value="publish" className="btn btn-primary btn-sm">Publish now</button>}
                    {["review", "approved", "scheduled"].includes(r.status) && <button name="op" value="draft" className="btn btn-outline btn-sm">Return to draft</button>}
                    {["draft", "review"].includes(r.status) && <button name="op" value="reject" className="btn btn-outline btn-sm">Reject</button>}
                    {r.status === "published" && <Link href={`/admin/articles/${r.id}#status`} className="btn btn-outline btn-sm">Retract…</Link>}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Corrections({ sp }: { sp: { msg?: string; err?: string } }) {
  const rows = all<{ id: number; note: string; kind: string; status: string; created_at: string; headline: string; article_id: number }>(
    "SELECT c.*, a.headline FROM corrections c JOIN articles a ON a.id = c.article_id ORDER BY c.status = 'pending' DESC, c.created_at DESC",
  );
  const published = all<{ id: number; headline: string }>("SELECT id, headline FROM articles WHERE status = 'published' ORDER BY published_at DESC LIMIT 200");
  return (
    <>
      <PageHead title="Corrections" sub="Pending corrections are not shown publicly until you publish them." actions={<Link href="/admin/pipeline" className="btn btn-outline btn-sm">Back to pipeline</Link>} />
      <Flash sp={sp} />
      <Panel title="Log a correction" className="mb-6">
        <form action={correctionAction} className="grid gap-3 md:grid-cols-[2fr_1fr_3fr_auto]">
          <input type="hidden" name="op" value="create" />
          <select name="article_id" className="input" aria-label="Article" required>
            {published.map((a) => <option key={a.id} value={a.id}>{a.headline}</option>)}
          </select>
          <select name="kind" className="input" aria-label="Kind">
            <option value="correction">Correction</option>
            <option value="factual_error">Factual error</option>
          </select>
          <input name="note" required className="input" placeholder="What was wrong and what changed" aria-label="Note" />
          <button className="btn btn-dark">Add</button>
        </form>
      </Panel>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Article</th><th>Note</th><th>Kind</th><th>Status</th><th>Logged</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/admin/articles/${c.article_id}`} className="hover:underline">{c.headline}</Link></td>
                <td>{c.note}</td>
                <td className="text-muted">{c.kind}</td>
                <td><Badge s={c.status === "pending" ? "review" : "published"} /></td>
                <td className="whitespace-nowrap text-muted">{formatDateTime(c.created_at)}</td>
                <td>
                  {c.status === "pending" && (
                    <form action={correctionAction} className="flex gap-1">
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="back" value="/admin/pipeline?tab=corrections" />
                      <button name="op" value="publish" className="btn btn-primary btn-sm">Publish</button>
                      <button name="op" value="delete" className="btn btn-outline btn-sm">Delete</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
