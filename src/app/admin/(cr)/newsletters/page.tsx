import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { all, scalar } from "@/lib/db";
import { subscriberAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/time";
import { Badge, Flash, PageHead, Panel } from "../ui";

export const metadata = { title: "Newsletters" };

export default async function NewslettersAdmin({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; nl?: string; msg?: string; err?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const tab = sp.tab || "issues";
  const newsletters = all<{ id: number; name: string; slug: string; cadence: string; is_premium: number; confirmed: number }>(
    "SELECT n.*, (SELECT COUNT(*) FROM newsletter_subscribers s WHERE s.newsletter_id = n.id AND s.status = 'confirmed') AS confirmed FROM newsletters n WHERE n.is_active = 1 ORDER BY sort_order",
  );
  const tabs = (
    <div className="mb-6 flex gap-2 text-sm">
      {[["issues", "Issues"], ["subscribers", "Subscribers"], ["outbox", "Outbox"]].map(([v, l]) => (
        <Link key={v} href={`/admin/newsletters?tab=${v}`} className={`rounded-full border px-3 py-1 ${tab === v ? "border-charcoal bg-charcoal text-white" : "border-line bg-white"}`}>{l}</Link>
      ))}
    </div>
  );
  return (
    <>
      <PageHead title="Newsletters" sub="The Daily Story, The MedTwenty Weekly and The Analyst Note." actions={tab === "subscribers" ? <a href={`/admin/newsletters/export${sp.nl ? `?nl=${sp.nl}` : ""}`} className="btn btn-outline btn-sm">Export CSV</a> : undefined} />
      <Flash sp={sp} />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {newsletters.map((n) => (
          <div key={n.id} className="card p-5">
            <p className="font-serif text-lg font-semibold">{n.name}</p>
            <p className="text-xs text-muted">{n.cadence}{n.is_premium ? " · Premium" : " · Free"}</p>
            <p className="mt-2 font-serif text-2xl font-bold">{n.confirmed} <span className="text-sm font-normal text-muted">confirmed</span></p>
          </div>
        ))}
      </div>
      {tabs}
      {tab === "issues" && <Issues />}
      {tab === "subscribers" && <Subscribers q={sp.q} nl={sp.nl} newsletters={newsletters} />}
      {tab === "outbox" && <Outbox />}
    </>
  );
}

function Issues() {
  const issues = all<{ id: number; subject: string; status: string; name: string; scheduled_for: string | null; sent_at: string | null; recipients: number; created_at: string; opens: number; clicks: number; unsubs: number }>(
    `SELECT i.*, n.name,
      (SELECT COUNT(DISTINCT e.outbox_id) FROM email_events e WHERE e.issue_id = i.id AND e.type = 'opened') AS opens,
      (SELECT COUNT(DISTINCT e.outbox_id) FROM email_events e WHERE e.issue_id = i.id AND e.type = 'clicked') AS clicks,
      (SELECT COUNT(*) FROM email_events e WHERE e.issue_id = i.id AND e.type IN ('unsubscribed','complained')) AS unsubs
     FROM newsletter_issues i JOIN newsletters n ON n.id = i.newsletter_id ORDER BY i.created_at DESC LIMIT 100`,
  );
  return (
    <div className="card overflow-x-auto">
      <table className="table min-w-[800px]">
        <thead><tr><th>Issue</th><th>Newsletter</th><th>Status</th><th>When</th><th>Recipients</th><th>Opens</th><th>Clicks</th><th>Unsubs</th></tr></thead>
        <tbody>
          {issues.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted">No issues yet. They are created when you publish a story or briefing.</td></tr>}
          {issues.map((i) => (
            <tr key={i.id}>
              <td><Link href={`/admin/newsletters/${i.id}`} className="font-medium hover:underline">{i.subject}</Link></td>
              <td className="text-muted">{i.name}</td>
              <td><Badge s={i.status} /></td>
              <td className="whitespace-nowrap text-muted">{formatDateTime(i.sent_at || i.scheduled_for || i.created_at)}</td>
              <td>{i.recipients}</td>
              <td>{i.recipients ? `${Math.round((i.opens / i.recipients) * 100)}%` : "—"}</td>
              <td>{i.recipients ? `${Math.round((i.clicks / i.recipients) * 100)}%` : "—"}</td>
              <td>{i.unsubs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Subscribers({ q, nl, newsletters }: { q?: string; nl?: string; newsletters: { id: number; name: string }[] }) {
  const where = ["1=1"];
  const p: unknown[] = [];
  if (q) { where.push("s.email LIKE ?"); p.push(`%${q}%`); }
  if (nl) { where.push("s.newsletter_id = ?"); p.push(Number(nl)); }
  const rows = all<{ id: number; email: string; status: string; source: string | null; consent_at: string | null; created_at: string; name: string }>(
    `SELECT s.*, n.name FROM newsletter_subscribers s JOIN newsletters n ON n.id = s.newsletter_id WHERE ${where.join(" AND ")} ORDER BY s.created_at DESC LIMIT 300`,
    ...p,
  );
  const total = scalar<number>(`SELECT COUNT(*) FROM newsletter_subscribers s WHERE ${where.join(" AND ")}`, ...p);
  return (
    <>
      <form className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="tab" value="subscribers" />
        <input name="q" defaultValue={q} placeholder="Search email" className="input w-64 py-1.5 text-sm" aria-label="Search email" />
        <select name="nl" defaultValue={nl || ""} className="input w-auto py-1.5 text-sm" aria-label="Newsletter">
          <option value="">All newsletters</option>
          {newsletters.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
        <button className="btn btn-outline btn-sm">Search</button>
        <span className="self-center text-sm text-muted">{total} rows</span>
      </form>
      <div className="card overflow-x-auto">
        <table className="table min-w-[800px]">
          <thead><tr><th>Email</th><th>Newsletter</th><th>Status</th><th>Source</th><th>Consent</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.email}</td>
                <td className="text-muted">{r.name}</td>
                <td><Badge s={r.status === "confirmed" ? "published" : r.status === "pending" ? "review" : "canceled"} /> <span className="text-xs">{r.status}</span></td>
                <td className="text-muted">{r.source}</td>
                <td className="whitespace-nowrap text-muted">{formatDateTime(r.consent_at)}</td>
                <td>
                  <form action={subscriberAction} className="flex gap-1">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="back" value="/admin/newsletters?tab=subscribers" />
                    {r.status !== "unsubscribed" && <button name="op" value="unsubscribe" className="btn btn-outline btn-sm">Unsubscribe</button>}
                    <button name="op" value="gdpr_delete" className="btn btn-outline btn-sm text-down">GDPR delete</button>
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

function Outbox() {
  const rows = all<{ id: number; to_email: string; subject: string; kind: string; status: string; created_at: string; error: string | null }>("SELECT id, to_email, subject, kind, status, created_at, error FROM email_outbox ORDER BY id DESC LIMIT 200");
  return (
    <Panel title="Every email the site has sent or logged">
      {!process.env.RESEND_API_KEY && <p className="mb-3 text-sm text-muted">Resend is not connected, so emails are logged here instead of being sent. Open one to see exactly what would be delivered.</p>}
      <div className="overflow-x-auto">
        <table className="table min-w-[700px]">
          <thead><tr><th>To</th><th>Subject</th><th>Kind</th><th>Status</th><th>When</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.to_email}</td>
                <td><a href={`/admin/newsletters/outbox/${r.id}`} target="_blank" className="hover:underline">{r.subject}</a>{r.error && <p className="text-xs text-down">{r.error}</p>}</td>
                <td className="text-muted">{r.kind}</td>
                <td className="text-muted">{r.status}</td>
                <td className="whitespace-nowrap text-muted">{formatDateTime(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
