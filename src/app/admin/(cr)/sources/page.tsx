import { requireStaff } from "@/lib/auth";
import { all } from "@/lib/db";
import { activeCategories } from "@/lib/content";
import { getSettings } from "@/lib/settings";
import { sourceAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/time";
import { Flash, PageHead, Panel } from "../ui";
import Link from "next/link";

export const metadata = { title: "Sources" };

type Src = { id: number; name: string; feed_url: string | null; source_type: string; category_slug: string | null; cadence: string; is_active: number; needs_verification: number; last_checked_at: string | null; last_success_at: string | null; last_error: string | null; items_last_run: number | null };

function health(s: Src): "green" | "amber" | "red" | "grey" {
  if (!s.is_active) return "grey";
  if (s.last_error && (!s.last_success_at || (s.last_checked_at && s.last_checked_at > s.last_success_at))) return "red";
  if (!s.last_success_at) return "amber";
  const hours = (Date.now() - new Date(s.last_success_at).getTime()) / 3600_000;
  const limit = { multiple_daily: 12, daily: 36, weekly: 24 * 9, event: 24 * 30 }[s.cadence] ?? 36;
  return hours <= limit ? "green" : hours <= limit * 2 ? "amber" : "red";
}
const DOT = { green: "bg-up", amber: "bg-[#d99a00]", red: "bg-down", grey: "bg-[#bbb]" };

export default async function Sources({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const sources = all<Src>("SELECT * FROM sources ORDER BY is_active DESC, name");
  const cats = activeCategories();
  const runs = all<{ id: number; external_id: string; status: string; started_at: string; finished_at: string | null; counts: string | null; errors: string | null }>("SELECT * FROM ingestion_runs ORDER BY id DESC LIMIT 20");
  const s = getSettings();
  return (
    <>
      <PageHead
        title="Sources"
        sub="Control panel for the n8n → Kimi → Claude pipeline. n8n reads this list from GET /api/ingest/sources."
        actions={<Link href="/admin/settings" className="btn btn-outline btn-sm">{s.ingest_paused ? "Ingestion paused" : "Ingestion on"} · cap {s.ingest_daily_cap}/day</Link>}
      />
      <Flash sp={sp} />
      <div className="card overflow-x-auto">
        <table className="table min-w-[1000px]">
          <thead><tr><th>Health</th><th>Source</th><th>Type</th><th>Category</th><th>Cadence</th><th>Last success</th><th>Items last run</th><th /></tr></thead>
          <tbody>
            {sources.map((x) => {
              const h = health(x);
              return (
                <tr key={x.id}>
                  <td><span className={`inline-block h-3 w-3 rounded-full ${DOT[h]}`} aria-label={h} title={h} /></td>
                  <td>
                    <p className="font-medium">{x.name}</p>
                    {x.feed_url && <p className="max-w-xs truncate text-xs text-muted">{x.feed_url}</p>}
                    {!!x.needs_verification && <p className="text-xs text-[#7a5200]">Needs feed verification</p>}
                    {x.last_error && <p className="text-xs text-down">{x.last_error}</p>}
                  </td>
                  <td className="text-muted">{x.source_type}</td>
                  <td>
                    <form action={sourceAction}>
                      <input type="hidden" name="id" value={x.id} /><input type="hidden" name="op" value="category" />
                      <select name="category_slug" defaultValue={x.category_slug || ""} className="input py-1 text-xs" aria-label="Category">{cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
                      <button className="mt-1 text-xs underline">Save</button>
                    </form>
                  </td>
                  <td>
                    <form action={sourceAction}>
                      <input type="hidden" name="id" value={x.id} /><input type="hidden" name="op" value="cadence" />
                      <select name="cadence" defaultValue={x.cadence} className="input py-1 text-xs" aria-label="Cadence">
                        <option value="multiple_daily">Multiple daily</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="event">Event</option>
                      </select>
                      <button className="mt-1 text-xs underline">Save</button>
                    </form>
                  </td>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(x.last_success_at) || "Never"}</td>
                  <td>{x.items_last_run ?? "—"}</td>
                  <td>
                    <form action={sourceAction} className="flex flex-wrap gap-1">
                      <input type="hidden" name="id" value={x.id} />
                      <button name="op" value="toggle" className="btn btn-outline btn-sm">{x.is_active ? "Pause" : "Resume"}</button>
                      {x.last_error && <button name="op" value="retry" className="btn btn-outline btn-sm">Retry</button>}
                      {!!x.needs_verification && <button name="op" value="verified" className="btn btn-outline btn-sm">Feed verified</button>}
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Panel title="Add a source" className="mt-6">
        <form action={sourceAction} className="grid gap-2 md:grid-cols-6">
          <input type="hidden" name="op" value="create" />
          <input name="name" required placeholder="Name" className="input md:col-span-2" aria-label="Name" />
          <input name="feed_url" placeholder="Feed or page URL" className="input md:col-span-2" aria-label="Feed URL" />
          <select name="source_type" className="input" aria-label="Type"><option value="rss">RSS</option><option value="monitor">Monitor</option><option value="manual">Manual</option></select>
          <select name="cadence" className="input" aria-label="Cadence"><option value="daily">Daily</option><option value="multiple_daily">Multiple daily</option><option value="weekly">Weekly</option><option value="event">Event</option></select>
          <select name="category_slug" className="input md:col-span-2" aria-label="Category">{cats.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>
          <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="needs_verification" defaultChecked /> Needs feed verification</label>
          <button className="btn btn-dark">Add source</button>
        </form>
      </Panel>

      <Panel title="Ingestion runs" className="mt-6">
        {runs.length === 0 && <p className="text-sm text-muted">No runs reported yet. n8n reports them to POST /api/ingest/runs.</p>}
        <ul className="space-y-2 text-sm">
          {runs.map((r) => {
            const errs = r.errors ? (JSON.parse(r.errors) as unknown[]) : [];
            return (
              <li key={r.id} className="rounded border border-line p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${r.status === "failed" ? "bg-down" : r.status === "running" ? "bg-[#d99a00]" : errs.length ? "bg-[#d99a00]" : "bg-up"}`} />
                  <span className="font-mono text-xs">{r.external_id}</span>
                  <span className="text-muted">{formatDateTime(r.started_at)} → {r.finished_at ? formatDateTime(r.finished_at) : "running"}</span>
                  <span>{r.status}</span>
                </div>
                {r.counts && <pre className="mt-2 overflow-x-auto text-xs">{r.counts}</pre>}
                {errs.length > 0 && <pre className="mt-2 overflow-x-auto text-xs text-down">{JSON.stringify(errs, null, 1)}</pre>}
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}
