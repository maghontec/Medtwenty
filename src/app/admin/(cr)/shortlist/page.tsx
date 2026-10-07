import { requireStaff } from "@/lib/auth";
import { all } from "@/lib/db";
import { activeCategories } from "@/lib/content";
import { addCandidateAction, candidateDecisionAction, tickCandidateAction } from "@/app/actions/admin";
import { formatDate, ukDate } from "@/lib/time";
import { Flash, PageHead, Panel } from "../ui";
import Link from "next/link";

export const metadata = { title: "Shortlist" };

const TICKS = [
  ["material", "Material to healthcare businesses, investors or decision-makers"],
  ["source", "Reliable primary source"],
  ["adds", "Adds something beyond the headline"],
  ["time", "Can be done well in the time available"],
] as const;

type Item = { id: number; raw_title: string; source_url: string; source_outlet: string | null; suggested_category: string | null; ai_summary: string | null; note: string | null; significance_score: number | null; ticks: string; status: string; created_at: string; published_at: string | null; origin: string; article_id: number | null; source_id: number | null };

export default async function Shortlist({ searchParams }: { searchParams: Promise<{ cat?: string; src?: string; all?: string; view?: string; msg?: string; err?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const cats = activeCategories();
  const view = sp.view === "dismissed" ? "dismissed" : sp.view === "analysis" ? "saved_analysis" : "new";
  const where = ["status = ?"];
  const params: unknown[] = [view];
  if (sp.cat) { where.push("suggested_category = ?"); params.push(sp.cat); }
  if (sp.src) { where.push("source_outlet = ?"); params.push(sp.src); }
  const items = all<Item>(`SELECT * FROM extracted_items WHERE ${where.join(" AND ")} ORDER BY created_at DESC, COALESCE(significance_score, 0) DESC LIMIT 500`, ...params);
  const outlets = all<{ source_outlet: string }>("SELECT DISTINCT source_outlet FROM extracted_items WHERE source_outlet IS NOT NULL ORDER BY 1");

  // Group by day; show the top 15 by significance per day unless "Show all".
  const groups = new Map<string, Item[]>();
  for (const it of items) {
    const d = ukDate(new Date(it.created_at));
    groups.set(d, [...(groups.get(d) || []), it]);
  }
  const catName = (slug: string | null) => cats.find((c) => c.slug === slug)?.name || "Uncategorised";

  return (
    <>
      <PageHead title="Shortlist" sub="Candidates from the pipeline and ones you add by hand. Nothing here is published until you write and publish it." />
      <Flash sp={sp} />
      <Panel title="Add a candidate by hand" className="mb-6">
        <form action={addCandidateAction} className="grid gap-3 md:grid-cols-[2fr_2fr_1fr_auto]">
          <div>
            <label className="label" htmlFor="u">Source URL</label>
            <input id="u" name="source_url" type="url" required className="input" placeholder="https://" />
          </div>
          <div>
            <label className="label" htmlFor="t">Title</label>
            <input id="t" name="title" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="c">Category</label>
            <select id="c" name="category" className="input">
              <option value="">—</option>
              {cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-end"><button className="btn btn-dark w-full">Add</button></div>
          <div className="md:col-span-4">
            <label className="label" htmlFor="n">Note (optional)</label>
            <input id="n" name="note" className="input" />
          </div>
        </form>
      </Panel>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {[["new", "Candidates"], ["analysis", "Saved for analysis"], ["dismissed", "Dismissed"]].map(([v, l]) => (
          <Link key={v} href={`/admin/shortlist?view=${v}`} className={`rounded-full border px-3 py-1 ${(sp.view || "new") === v ? "border-charcoal bg-charcoal text-white" : "border-line bg-white"}`}>{l}</Link>
        ))}
        <form className="ml-auto flex gap-2">
          <input type="hidden" name="view" value={sp.view || "new"} />
          <select name="cat" defaultValue={sp.cat || ""} className="input py-1.5 text-sm" aria-label="Category">
            <option value="">All categories</option>
            {cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
          <select name="src" defaultValue={sp.src || ""} className="input py-1.5 text-sm" aria-label="Source">
            <option value="">All sources</option>
            {outlets.map((o) => <option key={o.source_outlet} value={o.source_outlet}>{o.source_outlet}</option>)}
          </select>
          <button className="btn btn-outline btn-sm">Filter</button>
        </form>
      </div>

      {items.length === 0 && <p className="py-10 text-center text-muted">Nothing here.</p>}
      {[...groups.entries()].map(([day, list]) => {
        const ranked = [...list].sort((a, b) => (b.significance_score ?? 0) - (a.significance_score ?? 0));
        const shown = sp.all || view !== "new" ? ranked : ranked.slice(0, 15);
        return (
          <section key={day} className="mb-8">
            <h2 className="eyebrow mb-3 text-muted">{formatDate(day, { weekday: "long" })} · {list.length}</h2>
            <div className="space-y-3">
              {shown.map((it) => {
                const ticks = JSON.parse(it.ticks || "{}") as Record<string, boolean>;
                return (
                  <article key={it.id} className="card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <a href={it.source_url} target="_blank" rel="noopener noreferrer" className="font-serif text-lg font-semibold hover:underline">{it.raw_title}</a>
                        <p className="mt-0.5 text-xs text-muted">
                          {it.source_outlet} · {catName(it.suggested_category)}
                          {it.significance_score != null && ` · significance ${it.significance_score}`} · {it.origin}
                        </p>
                        {it.ai_summary && <p className="mt-2 text-sm">{it.ai_summary}</p>}
                        {it.note && <p className="mt-1 text-sm italic text-muted">{it.note}</p>}
                      </div>
                    </div>
                    {view === "new" && (
                      <>
                        <div className="mt-3 grid gap-1 sm:grid-cols-2">
                          {TICKS.map(([k, label]) => (
                            <form key={k} action={tickCandidateAction}>
                              <input type="hidden" name="id" value={it.id} />
                              <input type="hidden" name="tick" value={k} />
                              <button className="flex items-center gap-2 text-left text-sm" aria-pressed={!!ticks[k]}>
                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${ticks[k] ? "border-rust bg-rust text-white" : "border-[#bbb]"}`}>{ticks[k] ? "✓" : ""}</span>
                                {label}
                              </button>
                            </form>
                          ))}
                        </div>
                        <form action={candidateDecisionAction} className="mt-4 flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={it.id} />
                          <button name="op" value="write" className="btn btn-primary btn-sm" disabled={!ticks.source} title={ticks.source ? undefined : "Tick Reliable primary source first"}>Write story</button>
                          <button name="op" value="analysis" className="btn btn-outline btn-sm">Save for monthly analysis</button>
                          <input name="reason" placeholder="Dismiss reason (optional)" className="input w-56 py-1.5 text-sm" aria-label="Dismiss reason" />
                          <button name="op" value="dismiss" className="btn btn-outline btn-sm">Dismiss</button>
                        </form>
                      </>
                    )}
                    {view !== "new" && (
                      <form action={candidateDecisionAction} className="mt-3 flex gap-2">
                        <input type="hidden" name="id" value={it.id} />
                        <input type="hidden" name="back" value={`/admin/shortlist?view=${sp.view}`} />
                        {view === "saved_analysis" && <button name="op" value="start_analysis" className="btn btn-primary btn-sm">Start analysis</button>}
                        <button name="op" value="restore" className="btn btn-outline btn-sm">Back to candidates</button>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
            {!sp.all && view === "new" && ranked.length > 15 && (
              <Link href={`/admin/shortlist?all=1`} className="mt-3 inline-block text-sm underline">Show all {ranked.length}</Link>
            )}
          </section>
        );
      })}
    </>
  );
}
