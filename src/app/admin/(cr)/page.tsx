import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { all, get, scalar } from "@/lib/db";
import { getOrCreateCurrentEdition } from "@/lib/content";
import { addDays, ukDate, weekdayName } from "@/lib/time";
import { PageHead, Panel, Stat, Badge } from "./ui";

export const metadata = { title: "Overview" };

export default async function Overview() {
  await requireStaff();
  const ed = getOrCreateCurrentEdition();
  const today = ukDate();
  const pieces = all<{ id: number; headline: string; published_at: string; content_type: string }>(
    "SELECT id, headline, published_at, content_type FROM articles WHERE edition_id = ? AND status = 'published' ORDER BY published_at",
    ed.id,
  );
  const days = [0, 1, 2, 3, 4].map((i) => {
    const d = addDays(ed.week_start, i);
    return { d, name: weekdayName(d), items: pieces.filter((p) => ukDate(new Date(p.published_at)) === d && p.content_type !== "briefing") };
  });
  const drafts = scalar<number>("SELECT COUNT(*) FROM articles WHERE status = 'draft'") ?? 0;
  const review = scalar<number>("SELECT COUNT(*) FROM articles WHERE status IN ('review','approved','scheduled')") ?? 0;
  const briefing = get<{ id: number; slug: string }>("SELECT id, slug FROM articles WHERE content_type = 'briefing' AND edition_id = ? AND status = 'published'", ed.id);
  const weekStartIso = new Date(ed.week_start + "T00:00:00Z").toISOString();
  const minutes = scalar<number>("SELECT COALESCE(SUM(editorial_minutes), 0) FROM articles WHERE (edition_id = ? OR (status != 'published' AND updated_at >= ?))", ed.id, weekStartIso) ?? 0;
  const budget = 600;
  const signups = scalar<number>("SELECT COUNT(*) FROM users WHERE created_at >= ?", weekStartIso) ?? 0;
  const premium = scalar<number>("SELECT COUNT(*) FROM subscriptions WHERE created_at >= ? AND status IN ('active','past_due')", weekStartIso) ?? 0;
  const pastDue = scalar<number>("SELECT COUNT(*) FROM subscriptions WHERE status = 'past_due'") ?? 0;
  const corrections = scalar<number>("SELECT COUNT(*) FROM corrections WHERE status = 'pending'") ?? 0;
  const shortlist = scalar<number>("SELECT COUNT(*) FROM extracted_items WHERE status = 'new'") ?? 0;
  const messages = scalar<number>("SELECT COUNT(*) FROM contact_messages WHERE created_at >= ?", weekStartIso) ?? 0;

  return (
    <>
      <PageHead title="Overview" sub={`${ed.week_label} · week starting ${ed.week_start}`} actions={<Link href="/admin/shortlist" className="btn btn-primary btn-sm">Open shortlist ({shortlist})</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Drafts" value={drafts} />
        <Stat label="In review / approved" value={review} />
        <Stat label="New free sign-ups this week" value={signups} />
        <Stat label="New Premium this week" value={premium} sub={pastDue ? `${pastDue} past due` : "No past-due payments"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="This week's edition">
          <ul>
            {days.map((d) => (
              <li key={d.d} className="flex gap-4 border-b border-line py-3 last:border-0">
                <span className={`w-24 shrink-0 text-sm font-semibold ${d.d === today ? "text-rust-text" : ""}`}>{d.name}</span>
                {d.items.length ? (
                  <ul className="space-y-1 text-sm">
                    {d.items.map((p) => (
                      <li key={p.id}>
                        <Link href={`/admin/articles/${p.id}`} className="hover:underline">{p.headline}</Link> {p.content_type === "analysis" && <Badge s="analysis" />}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-sm text-muted">{d.d > today ? "—" : `${d.name}: nothing published${d.d === today ? " yet" : ""}`}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm">
            Friday briefing:{" "}
            {briefing ? (
              <Link href={`/news/${briefing.slug}`} className="font-semibold text-up underline">published</Link>
            ) : (
              <Link href="/admin/briefing" className="font-semibold text-rust-text underline">not yet published</Link>
            )}
          </p>
        </Panel>

        <div className="space-y-6">
          <Panel title="Editorial time this week">
            <p className="font-serif text-3xl font-bold">
              {(minutes / 60).toFixed(1)}h <span className="text-base font-normal text-muted">of 10h budget</span>
            </p>
            <div className="mt-3 h-3 rounded bg-cream" role="progressbar" aria-valuenow={minutes} aria-valuemin={0} aria-valuemax={budget}>
              <div className={`h-3 rounded ${minutes > budget ? "bg-down" : "bg-rust"}`} style={{ width: `${Math.min(100, (minutes / budget) * 100)}%` }} />
            </div>
            {minutes > budget && <p className="mt-2 text-sm text-down">Over budget. The operating plan says reduce output or fund help.</p>}
          </Panel>
          <Panel title="Needs attention">
            <ul className="space-y-2 text-sm">
              <li>Pending corrections: <Link href="/admin/pipeline?tab=corrections" className="font-semibold underline">{corrections}</Link></li>
              <li>Past-due payments: <Link href="/admin/members?status=past_due" className="font-semibold underline">{pastDue}</Link></li>
              <li>Contact messages this week: <Link href="/admin/members?tab=messages" className="font-semibold underline">{messages}</Link></li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
