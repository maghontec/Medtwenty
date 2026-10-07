import Link from "next/link";
import { all } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS, FLAG_DESCRIPTIONS, type SettingKey } from "@/lib/settings-defaults";
import { legalAction, redirectAction, settingsAction } from "@/app/actions/admin";
import { formatDate } from "@/lib/time";
import { Flash, PageHead, Panel } from "../ui";

export const metadata = { title: "Site settings" };

const GROUPS: { title: string; keys: SettingKey[] }[] = [
  { title: "Identity", keys: ["site_name", "descriptor", "tagline", "meta_description", "company_name", "company_address", "contact_email", "social_linkedin", "social_x"] },
  { title: "Launch and payments", keys: ["launch_mode", "launch_date", "vat_registered", "show_paid_tiers", "rebrand_notice"] },
  { title: "Reveal flags", keys: ["show_deal_tracker", "show_regulatory_pipeline", "show_waiting_list", "show_intelligence_nav", "show_indices_strip", "show_api_page", "show_research_centre", "show_us_edition", "show_canada_edition"] },
  { title: "Ingestion", keys: ["ingest_paused", "ingest_daily_cap"] },
];

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string; msg?: string; err?: string }> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const isSuper = staff.roles.includes("super_admin");
  const tab = sp.tab || "settings";
  const s = getSettings();
  const tabs = (
    <div className="mb-6 flex gap-2 text-sm">
      {[["settings", "Settings and flags"], ["legal", "Legal pages"], ["redirects", "Redirects"]].map(([v, l]) => (
        <Link key={v} href={`/admin/settings?tab=${v}`} className={`rounded-full border px-3 py-1 ${tab === v ? "border-charcoal bg-charcoal text-white" : "border-line bg-white"}`}>{l}</Link>
      ))}
    </div>
  );

  if (tab === "legal") {
    const pages = all<{ slug: string; title: string; body: string; reviewed_at: string | null; updated_at: string }>("SELECT * FROM legal_pages ORDER BY slug");
    return (
      <>
        <PageHead title="Site settings" />
        {tabs}
        <Flash sp={sp} />
        <div className="space-y-6">
          {pages.map((p) => (
            <Panel key={p.slug} title={`/${p.slug}`} actions={p.reviewed_at ? <span className="text-xs text-up">Reviewed {formatDate(p.reviewed_at)}</span> : <span className="eyebrow rounded bg-[#fdf0d5] px-2 py-1 text-[0.6rem] text-[#7a5200]">Draft for legal review</span>}>
              <form action={legalAction} className="space-y-3">
                <input type="hidden" name="slug" value={p.slug} />
                <fieldset disabled={!isSuper} className="space-y-3">
                  <input name="title" defaultValue={p.title} className="input" aria-label="Title" />
                  <textarea name="body" defaultValue={p.body} rows={10} className="input font-mono text-xs" aria-label="Body (Markdown)" />
                </fieldset>
                {isSuper && (
                  <div className="flex gap-2">
                    <button className="btn btn-outline btn-sm">Save (resets review)</button>
                    {p.reviewed_at ? <button name="op" value="unreview" className="btn btn-outline btn-sm">Mark as draft</button> : <button name="op" value="reviewed" className="btn btn-primary btn-sm">Mark reviewed</button>}
                  </div>
                )}
              </form>
            </Panel>
          ))}
        </div>
      </>
    );
  }

  if (tab === "redirects") {
    const rows = all<{ from_path: string; to_path: string; note: string | null }>("SELECT * FROM redirects ORDER BY from_path");
    return (
      <>
        <PageHead title="Site settings" sub="301 redirects for old VanadiumNews URLs and retired sections." />
        {tabs}
        <Flash sp={sp} />
        {isSuper && (
          <Panel title="Add a redirect" className="mb-6">
            <form action={redirectAction} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
              <input name="from_path" placeholder="/old/path" required className="input" aria-label="From" />
              <input name="to_path" placeholder="/new/path" required className="input" aria-label="To" />
              <input name="note" placeholder="Note" className="input" aria-label="Note" />
              <button className="btn btn-dark">Add</button>
            </form>
          </Panel>
        )}
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>From</th><th>To</th><th>Note</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.from_path}>
                  <td className="font-mono text-xs">{r.from_path}</td>
                  <td className="font-mono text-xs">{r.to_path}</td>
                  <td className="text-muted">{r.note}</td>
                  <td>{isSuper && <form action={redirectAction}><input type="hidden" name="from_path" value={r.from_path} /><button name="op" value="delete" className="btn btn-outline btn-sm">Delete</button></form>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead title="Site settings" sub={isSuper ? "Changes apply to the public site immediately and are written to the audit log." : "Only the super admin can change settings."} />
      {tabs}
      <Flash sp={sp} />
      <form action={settingsAction} className="space-y-6">
        <fieldset disabled={!isSuper} className="space-y-6">
          {GROUPS.map((g) => (
            <Panel key={g.title} title={g.title}>
              <div className="divide-y divide-line">
                {g.keys.map((k) => {
                  const def = DEFAULT_SETTINGS[k];
                  const v = s[k];
                  return (
                    <div key={k} className="grid gap-2 py-3 md:grid-cols-[1fr_1.2fr] md:items-center">
                      <input type="hidden" name={`present_${k}`} value="1" />
                      <div>
                        <label htmlFor={k} className="font-mono text-sm font-semibold">{k}</label>
                        {FLAG_DESCRIPTIONS[k] && <p className="text-xs text-muted">{FLAG_DESCRIPTIONS[k]}</p>}
                      </div>
                      {typeof def === "boolean" ? (
                        <label className="flex items-center gap-2 text-sm">
                          <input id={k} type="checkbox" name={k} defaultChecked={v as boolean} className="h-5 w-5 accent-[#a64f1c]" /> {v ? "On" : "Off"}
                        </label>
                      ) : k === "launch_date" ? (
                        <input id={k} name={k} type="date" defaultValue={String(v)} className="input" />
                      ) : typeof def === "number" ? (
                        <input id={k} name={k} type="number" defaultValue={String(v)} className="input" />
                      ) : (
                        <input id={k} name={k} defaultValue={String(v)} className="input" />
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>
          ))}
        </fieldset>
        {isSuper && <button className="btn btn-primary">Save settings</button>}
      </form>
    </>
  );
}
