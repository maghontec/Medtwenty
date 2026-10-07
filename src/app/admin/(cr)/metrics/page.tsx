import { requireStaff } from "@/lib/auth";
import { all, scalar } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { addDays, formatDate, weekLabel, weekStart } from "@/lib/time";
import { gbp } from "@/lib/format";
import { PageHead, Panel } from "../ui";

export const metadata = { title: "Metrics" };

const WEEKS = 8;

function Spark({ values, label }: { values: number[]; label: string }) {
  const w = 220;
  const h = 44;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - 4 - (v / max) * (h - 8)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-11 w-full" role="img" aria-label={`${label}: weekly trend ${values.map((v) => +v.toFixed(1)).join(", ")}`}>
      <polyline points={pts} fill="none" stroke="#a64f1c" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {values.length > 0 && <circle cx={w} cy={h - 4 - (values[values.length - 1] / max) * (h - 8)} r="3" fill="#a64f1c" />}
    </svg>
  );
}

function Metric({ n, title, value, sub, series, children }: { n: number; title: string; value: string; sub?: string; series: number[]; children?: React.ReactNode }) {
  return (
    <section className="card p-5">
      <p className="eyebrow text-[0.62rem] text-muted">{n}. {title}</p>
      <p className="mt-2 font-serif text-3xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
      <Spark values={series} label={title} />
      {children}
    </section>
  );
}

export default async function Metrics({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const period = sp.period === "month" ? "month" : "week";
  const thisWeek = weekStart();
  const weeks = Array.from({ length: WEEKS }, (_, i) => addDays(thisWeek, -7 * (WEEKS - 1 - i)));
  const iso = (d: string) => new Date(d + "T00:00:00Z").toISOString();
  const now = new Date().toISOString();
  const periodStart = period === "week" ? iso(thisWeek) : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();

  // 1. Minutes per published story
  const minutesPerStory = (from: string, to: string) => {
    const r = all<{ m: number | null; n: number }>("SELECT SUM(editorial_minutes) AS m, COUNT(*) AS n FROM articles WHERE content_type = 'story' AND status = 'published' AND published_at >= ? AND published_at < ?", from, to)[0];
    return r.n ? (r.m || 0) / r.n : 0;
  };
  const mps = weeks.map((w) => minutesPerStory(iso(w), iso(addDays(w, 7))));
  const mpsNow = minutesPerStory(periodStart, now);

  // 2. Returning readers (seen in 2+ different weeks in the last 8 weeks)
  const since8 = iso(weeks[0]);
  const visitorWeeks = all<{ v: string; wk: string }>(
    "SELECT DISTINCT COALESCE('u' || user_id, 'a' || anon_id) AS v, strftime('%Y-%W', created_at) AS wk FROM page_views WHERE created_at >= ? AND (user_id IS NOT NULL OR anon_id IS NOT NULL)",
    since8,
  );
  const weeksByVisitor = new Map<string, Set<string>>();
  for (const r of visitorWeeks) weeksByVisitor.set(r.v, (weeksByVisitor.get(r.v) || new Set()).add(r.wk));
  const returning = [...weeksByVisitor.values()].filter((s) => s.size >= 2).length;
  const returningSeries = weeks.map((w) => {
    const wk = all<{ v: string }>("SELECT DISTINCT COALESCE('u' || user_id, 'a' || anon_id) AS v FROM page_views WHERE created_at >= ? AND created_at < ?", iso(w), iso(addDays(w, 7)));
    return wk.filter((x) => (weeksByVisitor.get(x.v)?.size || 0) >= 2).length;
  });

  // 3. Newsletter subscribers
  const nl = all<{ name: string; id: number; confirmed: number; added: number; lost: number }>(
    `SELECT n.name, n.id,
      (SELECT COUNT(*) FROM newsletter_subscribers s WHERE s.newsletter_id = n.id AND s.status = 'confirmed') AS confirmed,
      (SELECT COUNT(*) FROM newsletter_subscribers s WHERE s.newsletter_id = n.id AND s.status = 'confirmed' AND s.consent_at >= ?) AS added,
      (SELECT COUNT(*) FROM email_events e JOIN newsletter_issues i ON i.id = e.issue_id WHERE i.newsletter_id = n.id AND e.type IN ('unsubscribed','complained','bounced') AND e.created_at >= ?) AS lost
     FROM newsletters n WHERE n.is_active = 1 ORDER BY n.sort_order`,
    periodStart,
    periodStart,
  );
  const subsSeries = weeks.map((w) => scalar<number>("SELECT COUNT(*) FROM newsletter_subscribers WHERE status = 'confirmed' AND consent_at < ?", iso(addDays(w, 7))) ?? 0);

  // 4. Engagement per issue
  const issues = all<{ id: number; subject: string; recipients: number; opens: number; clicks: number; sent_at: string }>(
    `SELECT i.id, i.subject, i.recipients, i.sent_at,
      (SELECT COUNT(DISTINCT outbox_id) FROM email_events e WHERE e.issue_id = i.id AND e.type = 'opened') AS opens,
      (SELECT COUNT(DISTINCT outbox_id) FROM email_events e WHERE e.issue_id = i.id AND e.type = 'clicked') AS clicks
     FROM newsletter_issues i WHERE i.status = 'sent' ORDER BY i.sent_at DESC LIMIT 10`,
  );
  const rate = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const openSeries = weeks.map((w) => {
    const r = all<{ rec: number | null; o: number | null }>(
      `SELECT SUM(i.recipients) AS rec, (SELECT COUNT(DISTINCT e.outbox_id) FROM email_events e JOIN newsletter_issues j ON j.id = e.issue_id WHERE e.type = 'opened' AND j.sent_at >= ? AND j.sent_at < ?) AS o
       FROM newsletter_issues i WHERE i.status = 'sent' AND i.sent_at >= ? AND i.sent_at < ?`,
      iso(w), iso(addDays(w, 7)), iso(w), iso(addDays(w, 7)),
    )[0];
    return rate(r.o || 0, r.rec || 0);
  });

  // 5. Premium conversion
  const premiumUsers = "SELECT user_id FROM subscriptions WHERE status IN ('active','past_due')";
  const activeFree = scalar<number>(`SELECT COUNT(*) FROM users WHERE id NOT IN (${premiumUsers})`) ?? 0;
  const newPremium = scalar<number>("SELECT COUNT(DISTINCT user_id) FROM subscriptions WHERE created_at >= ?", periodStart) ?? 0;
  const bySource = all<{ source: string; n: number }>("SELECT COALESCE(conversion_source, 'unknown') AS source, COUNT(*) AS n FROM subscriptions WHERE created_at >= ? GROUP BY 1 ORDER BY 2 DESC", periodStart);
  const convSeries = weeks.map((w) => scalar<number>("SELECT COUNT(*) FROM subscriptions WHERE created_at >= ? AND created_at < ?", iso(w), iso(addDays(w, 7))) ?? 0);

  // 6. Revenue per editorial hour
  const revenue = (from: string, to: string) => scalar<number>("SELECT COALESCE(SUM(amount_pence), 0) FROM payments WHERE paid_at >= ? AND paid_at < ?", from, to) ?? 0;
  const minutes = (from: string, to: string) => scalar<number>("SELECT COALESCE(SUM(editorial_minutes), 0) FROM articles WHERE status = 'published' AND published_at >= ? AND published_at < ?", from, to) ?? 0;
  const rph = (from: string, to: string) => {
    const m = minutes(from, to);
    return m ? revenue(from, to) / (m / 60) : 0;
  };
  const rphNow = rph(periodStart, now);
  const rphSeries = weeks.map((w) => rph(iso(w), iso(addDays(w, 7))) / 100);

  // 7. Corrections
  const corrMonth = scalar<number>("SELECT COUNT(*) FROM corrections WHERE created_at >= ?", new Date(Date.now() - 30 * 86400_000).toISOString()) ?? 0;
  const totalPub = scalar<number>("SELECT COUNT(*) FROM articles WHERE status IN ('published','retracted')") ?? 0;
  const totalCorr = scalar<number>("SELECT COUNT(*) FROM corrections") ?? 0;
  const corrSeries = weeks.map((w) => scalar<number>("SELECT COUNT(*) FROM corrections WHERE created_at >= ? AND created_at < ?", iso(w), iso(addDays(w, 7))) ?? 0);

  // Pieces and categories ranked by returning readers
  const returningIds = new Set([...weeksByVisitor.entries()].filter(([, s]) => s.size >= 2).map(([v]) => v));
  const pieceViews = all<{ article_id: number; v: string; headline: string; category: string | null }>(
    `SELECT DISTINCT p.article_id, COALESCE('u' || p.user_id, 'a' || p.anon_id) AS v, a.headline, c.name AS category
     FROM page_views p JOIN articles a ON a.id = p.article_id LEFT JOIN categories c ON c.id = a.category_id WHERE p.created_at >= ?`,
    since8,
  );
  const byPiece = new Map<number, { headline: string; category: string | null; n: number }>();
  const byCat = new Map<string, number>();
  for (const r of pieceViews) {
    if (!returningIds.has(r.v)) continue;
    const e = byPiece.get(r.article_id) || { headline: r.headline, category: r.category, n: 0 };
    e.n++;
    byPiece.set(r.article_id, e);
    byCat.set(r.category || "Uncategorised", (byCat.get(r.category || "Uncategorised") || 0) + 1);
  }
  const topPieces = [...byPiece.values()].sort((a, b) => b.n - a.n).slice(0, 15);
  const topCats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);

  const s = getSettings();
  const launch = s.launch_date;
  const reminders = launch
    ? [
        { at: addMonths(launch, 3), q: "Which topics attract repeat readership?" },
        { at: addMonths(launch, 6), q: "Are readers willing to pay for additional analysis?" },
      ]
    : [];

  return (
    <>
      <PageHead
        title="Metrics"
        sub={`The seven measures from the operating plan. Trend lines show the last ${WEEKS} weeks (${weekLabel(weeks[0])} to ${weekLabel(thisWeek)}).`}
        actions={
          <div className="flex rounded border border-line bg-white text-sm">
            <a href="/admin/metrics?period=week" className={`px-3 py-1.5 ${period === "week" ? "bg-charcoal text-white" : ""}`}>This week</a>
            <a href="/admin/metrics?period=month" className={`px-3 py-1.5 ${period === "month" ? "bg-charcoal text-white" : ""}`}>This month</a>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Metric n={1} title="Editorial minutes per published story" value={`${Math.round(mpsNow)} min`} sub="Target band for curated stories: 30-45 minutes" series={mps}>
          <div className="relative mt-2 h-2 rounded bg-cream">
            <div className="absolute h-2 rounded bg-[#cfe3d6]" style={{ left: `${(30 / 90) * 100}%`, width: `${(15 / 90) * 100}%` }} />
            <div className="absolute -top-1 h-4 w-1 rounded bg-rust" style={{ left: `${Math.min(100, (mpsNow / 90) * 100)}%` }} />
          </div>
        </Metric>
        <Metric n={2} title="Returning readers" value={String(returning)} sub="Visitors seen in two or more different weeks of the last 8 (analytics consent only)" series={returningSeries} />
        <Metric n={3} title="Newsletter subscribers" value={String(nl.reduce((a, b) => a + b.confirmed, 0))} sub="Confirmed, all active newsletters" series={subsSeries}>
          <ul className="mt-3 space-y-1 text-xs">
            {nl.map((n) => (
              <li key={n.id} className="flex justify-between">
                <span>{n.name}</span>
                <span>{n.confirmed} <span className={n.added - n.lost >= 0 ? "text-up" : "text-down"}>({n.added - n.lost >= 0 ? "+" : ""}{n.added - n.lost} this {period})</span></span>
              </li>
            ))}
          </ul>
        </Metric>
        <Metric n={4} title="Newsletter engagement" value={issues[0] ? `${rate(issues[0].opens, issues[0].recipients)}% open` : "No sends yet"} sub={issues[0] ? `Latest: ${issues[0].subject} · ${rate(issues[0].clicks, issues[0].recipients)}% click` : "Open and click rates come from Resend events"} series={openSeries}>
          <ul className="mt-3 space-y-1 text-xs">
            {issues.slice(0, 5).map((i) => (
              <li key={i.id} className="flex justify-between gap-2"><span className="truncate">{i.subject}</span><span className="shrink-0">{rate(i.opens, i.recipients)}% / {rate(i.clicks, i.recipients)}%</span></li>
            ))}
          </ul>
        </Metric>
        <Metric n={5} title="Premium conversion" value={`${rate(newPremium, activeFree)}%`} sub={`${newPremium} new Premium this ${period} ÷ ${activeFree} active Free members`} series={convSeries}>
          <ul className="mt-3 space-y-1 text-xs">
            {bySource.map((b) => <li key={b.source} className="flex justify-between"><span>{b.source}</span><span>{b.n}</span></li>)}
          </ul>
        </Metric>
        <Metric n={6} title="Revenue per editorial hour" value={gbp(Math.round(rphNow))} sub={`${gbp(revenue(periodStart, now))} revenue ÷ ${(minutes(periodStart, now) / 60).toFixed(1)} editorial hours this ${period}`} series={rphSeries} />
        <Metric n={7} title="Corrections and factual errors" value={`${corrMonth} this month`} sub={`${totalPub ? ((totalCorr / totalPub) * 100).toFixed(1) : "0"} per 100 published pieces (all time)`} series={corrSeries} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="Pieces ranked by returning readers (last 8 weeks)">
          {topPieces.length === 0 ? (
            <p className="text-sm text-muted">No returning-reader data yet. Page views are recorded only after a reader accepts analytics cookies.</p>
          ) : (
            <table className="table">
              <thead><tr><th>Piece</th><th>Category</th><th>Returning readers</th></tr></thead>
              <tbody>{topPieces.map((p, i) => <tr key={i}><td>{p.headline}</td><td className="text-muted">{p.category}</td><td>{p.n}</td></tr>)}</tbody>
            </table>
          )}
          {topCats.length > 0 && (
            <>
              <h3 className="eyebrow mb-2 mt-6 text-muted">Categories</h3>
              <ul className="text-sm">{topCats.map(([c, n]) => <li key={c} className="flex justify-between border-b border-line py-1.5"><span>{c}</span><span>{n}</span></li>)}</ul>
            </>
          )}
        </Panel>
        <Panel title="Reviews">
          {!launch && <p className="text-sm text-muted">Review dates appear once you press Launch on the checklist (it sets the launch date).</p>}
          <ul className="space-y-3">
            {reminders.map((r) => (
              <li key={r.at} className={`rounded border p-3 ${r.at <= new Date().toISOString().slice(0, 10) ? "border-rust bg-cream" : "border-line"}`}>
                <p className="text-xs text-muted">{formatDate(r.at)}</p>
                <p className="font-semibold">{r.q}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">Page views alone are not used as a success measure on this page.</p>
        </Panel>
      </div>
    </>
  );
}

function addMonths(ymd: string, n: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, d));
  return dt.toISOString().slice(0, 10);
}
