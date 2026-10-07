import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { all, get } from "@/lib/db";
import { getOrCreateCurrentEdition } from "@/lib/content";
import { analystNoteAction, candidateDecisionAction, publishBriefingAction } from "@/app/actions/admin";
import { formatDate } from "@/lib/time";
import { Flash, PageHead, Panel } from "../ui";
import { BriefingPicker } from "./BriefingPicker";

export const metadata = { title: "Weekly briefing" };

export default async function BriefingPage({ searchParams }: { searchParams: Promise<{ tab?: string; msg?: string; err?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const ed = getOrCreateCurrentEdition();
  const tabs = (
    <div className="mb-6 flex gap-2 text-sm">
      {[["", "This week"], ["history", "Edition history"], ["analysis", "Monthly analysis"]].map(([v, l]) => (
        <Link key={v} href={v ? `/admin/briefing?tab=${v}` : "/admin/briefing"} className={`rounded-full border px-3 py-1 ${(sp.tab || "") === v ? "border-charcoal bg-charcoal text-white" : "border-line bg-white"}`}>{l}</Link>
      ))}
    </div>
  );

  if (sp.tab === "history") {
    const eds = all<{ id: number; week_label: string; week_start: string; n: number; views: number; briefing: string | null; bslug: string | null }>(
      `SELECT e.id, e.week_label, e.week_start,
        (SELECT COUNT(*) FROM articles a WHERE a.edition_id = e.id AND a.status = 'published' AND a.content_type != 'briefing') AS n,
        (SELECT COALESCE(SUM(views), 0) FROM articles a WHERE a.edition_id = e.id) + (SELECT COUNT(*) FROM page_views p JOIN articles a ON a.id = p.article_id WHERE a.edition_id = e.id) AS views,
        (SELECT headline FROM articles a WHERE a.edition_id = e.id AND a.content_type = 'briefing' AND a.status = 'published') AS briefing,
        (SELECT slug FROM articles a WHERE a.edition_id = e.id AND a.content_type = 'briefing' AND a.status = 'published') AS bslug
       FROM editions e ORDER BY e.week_start DESC`,
    );
    return (
      <>
        <PageHead title="Weekly briefing" />
        {tabs}
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Week</th><th>Pieces</th><th>Briefing</th><th>Views</th></tr></thead>
            <tbody>
              {eds.map((e) => (
                <tr key={e.id}>
                  <td className="font-medium">{e.week_label}<p className="text-xs text-muted">from {formatDate(e.week_start)}</p></td>
                  <td>{e.n}</td>
                  <td>{e.bslug ? <Link href={`/news/${e.bslug}`} className="underline">{e.briefing}</Link> : <span className="text-muted">None</span>}</td>
                  <td>{e.views}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (sp.tab === "analysis") {
    const saved = all<{ id: number; raw_title: string; source_url: string; source_outlet: string | null; note: string | null }>("SELECT * FROM extracted_items WHERE status = 'saved_analysis' ORDER BY created_at DESC");
    const analyses = all<{ id: number; headline: string; status: string; published_at: string | null; slug: string }>("SELECT id, headline, status, published_at, slug FROM articles WHERE content_type = 'analysis' ORDER BY COALESCE(published_at, updated_at) DESC");
    return (
      <>
        <PageHead title="Weekly briefing" />
        {tabs}
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Saved for analysis">
            {saved.length === 0 && <p className="text-sm text-muted">Save candidates from the Shortlist to collect material for the monthly analysis.</p>}
            <ul className="space-y-3">
              {saved.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3 border-b border-line pb-3 text-sm">
                  <div><a href={s.source_url} target="_blank" rel="noreferrer" className="font-semibold hover:underline">{s.raw_title}</a><p className="text-xs text-muted">{s.source_outlet}</p></div>
                  <form action={candidateDecisionAction}><input type="hidden" name="id" value={s.id} /><button name="op" value="start_analysis" className="btn btn-primary btn-sm whitespace-nowrap">Start analysis</button></form>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Analyses">
            <ul className="space-y-3 text-sm">
              {analyses.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 border-b border-line pb-3">
                  <div><Link href={`/admin/articles/${a.id}`} className="font-semibold hover:underline">{a.headline}</Link><p className="text-xs text-muted">{a.status}{a.published_at ? ` · ${formatDate(a.published_at)}` : ""}</p></div>
                  {a.status === "published" && (
                    <form action={analystNoteAction}><input type="hidden" name="article_id" value={a.id} /><button className="btn btn-outline btn-sm whitespace-nowrap">Draft Analyst Note</button></form>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </>
    );
  }

  const pieces = all<{ id: number; headline: string; category_name: string | null; links: number; published_at: string; content_type: string }>(
    `SELECT a.id, a.headline, c.name AS category_name, a.published_at, a.content_type,
       (SELECT COUNT(*) FROM deals d WHERE d.article_id = a.id) + (SELECT COUNT(*) FROM regulatory_decisions r WHERE r.article_id = a.id) + (SELECT COUNT(*) FROM article_entities e WHERE e.article_id = a.id AND e.entity_type IN ('deal','regulatory')) AS links
     FROM articles a LEFT JOIN categories c ON c.id = a.category_id
     WHERE a.edition_id = ? AND a.status = 'published' AND a.content_type != 'briefing'
     ORDER BY links DESC, a.published_at DESC`,
    ed.id,
  );
  const existing = get<{ id: number; slug: string }>("SELECT id, slug FROM articles WHERE content_type = 'briefing' AND edition_id = ? AND status = 'published'", ed.id);

  return (
    <>
      <PageHead title="Weekly briefing" sub={`${ed.week_label}: choose up to five pieces, order them, and write the overview.`} />
      {tabs}
      <Flash sp={sp} />
      {existing ? (
        <Panel>
          <p>This week&apos;s briefing is published. <Link href={`/news/${existing.slug}`} className="underline">View it</Link> or <Link href="/admin/newsletters" className="underline">send The MedTwenty Weekly</Link>.</p>
        </Panel>
      ) : pieces.length === 0 ? (
        <Panel><p className="text-muted">Nothing has been published this week yet.</p></Panel>
      ) : (
        <form action={publishBriefingAction}>
          <BriefingPicker pieces={pieces.map((p) => ({ id: p.id, headline: p.headline, meta: `${p.category_name || p.content_type} · ${p.links} linked deals/decisions` }))} />
          <Panel title="Editorial overview" className="mt-6">
            <label className="label" htmlFor="standfirst">Standfirst (optional)</label>
            <input id="standfirst" name="standfirst" className="input mb-4" placeholder={pieces.length < 5 ? `A shorter week: ${pieces.length} developments that matter.` : "The five developments that mattered this week."} />
            <label className="label" htmlFor="overview">Overview (200-400 words: what they mean for healthcare businesses, investors and policymakers)</label>
            <textarea id="overview" name="overview" rows={12} required className="input" />
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="label" htmlFor="em">Editorial minutes</label>
                <input id="em" name="editorial_minutes" type="number" min={0} className="input w-32" />
              </div>
              <button className="btn btn-primary">Publish briefing</button>
            </div>
          </Panel>
        </form>
      )}
    </>
  );
}
