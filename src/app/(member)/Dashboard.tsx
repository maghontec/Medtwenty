import Link from "next/link";
import { all, run, scalar } from "@/lib/db";
import type { User } from "@/lib/auth";
import type { Entitlement } from "@/lib/entitlements";
import { FREE_PREMIUM_READS, premiumReadsThisMonth } from "@/lib/entitlements";
import { activeNewsletters, getOrCreateCurrentEdition, latestDecisions, latestDeals, latestOfType, publishedInEdition, type Article } from "@/lib/content";
import { memberNewsletterStatus } from "@/lib/newsletters";
import { followCompanyAction, newsletterToggleAction, portalAction } from "@/app/actions/member";
import { resendConfirmAction } from "@/app/actions/auth";
import { DealTable, DecisionTable } from "@/components/cards";
import { PremiumTag } from "@/components/Wordmark";
import { formatDate } from "@/lib/time";
import { getSettings } from "@/lib/settings";

function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card p-5 md:p-6" aria-label={title}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="eyebrow text-muted">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function StoryLink({ a }: { a: Article }) {
  return (
    <li className="border-b border-line py-3 last:border-0">
      <Link href={`/news/${a.slug}`} className="font-serif text-lg font-semibold leading-snug hover:text-rust-text">
        {a.headline}
      </Link>
      <div className="mt-1 flex items-center gap-3 text-xs text-muted">
        {formatDate(a.published_at, { year: undefined })} · {a.category_name}
        {!!a.is_premium && <PremiumTag />}
      </div>
    </li>
  );
}

export async function Dashboard({ user, ent, flags }: { user: User; ent: Entitlement; flags: { welcome?: boolean; limit?: boolean; confirmed?: boolean; upgrade?: boolean } }) {
  // "Since your last visit": roll last_seen_at forward at most every 30 minutes.
  const last = user.last_seen_at ? new Date(user.last_seen_at).getTime() : 0;
  let since = user.previous_seen_at;
  if (Date.now() - last > 30 * 60_000) {
    since = user.last_seen_at;
    run("UPDATE users SET previous_seen_at = last_seen_at, last_seen_at = ? WHERE id = ?", new Date().toISOString(), user.id);
  }
  const newCount = since
    ? scalar<number>("SELECT COUNT(*) FROM articles WHERE status = 'published' AND published_at > ? AND published_at <= ?", since, new Date().toISOString()) ?? 0
    : 0;

  const edition = getOrCreateCurrentEdition();
  const thisWeek = publishedInEdition(edition.id);
  const briefing = latestOfType("briefing");
  const analysis = latestOfType("analysis");
  const followed = all<{ id: number; name: string; slug: string; latest: string | null; latest_slug: string | null; deal: string | null }>(
    `SELECT c.id, c.name, c.slug,
       (SELECT a.headline FROM articles a JOIN article_entities e ON e.article_id = a.id AND e.entity_type = 'company' WHERE e.entity_id = c.id AND a.status = 'published' ORDER BY a.published_at DESC LIMIT 1) AS latest,
       (SELECT a.slug FROM articles a JOIN article_entities e ON e.article_id = a.id AND e.entity_type = 'company' WHERE e.entity_id = c.id AND a.status = 'published' ORDER BY a.published_at DESC LIMIT 1) AS latest_slug,
       (SELECT COALESCE(d.acquirer || ' → ', '') || d.target || ' · ' || COALESCE(d.value_text, 'Undisclosed') FROM deals d WHERE d.company_id = c.id AND d.verified = 1 ORDER BY d.announced_on DESC LIMIT 1) AS deal
     FROM watchlist_items w JOIN companies c ON c.id = w.company_id WHERE w.user_id = ? ORDER BY w.created_at`,
    user.id,
  );
  const followable = all<{ id: number; name: string }>(
    "SELECT id, name FROM companies WHERE is_stub = 0 AND id NOT IN (SELECT company_id FROM watchlist_items WHERE user_id = ?) ORDER BY name",
    user.id,
  );
  const nlStatus = memberNewsletterStatus(user.email);
  const newsletters = activeNewsletters().filter((n) => !n.is_premium || ent.premium);
  const reads = premiumReadsThisMonth(user.id);
  const back = ent.premium ? "/premium-dashboard" : "/dashboard";
  const s = getSettings();
  const archive = ent.premium
    ? all<Article>(
        "SELECT a.*, c.name AS category_name FROM articles a LEFT JOIN categories c ON c.id = a.category_id WHERE a.status = 'published' AND a.content_type IN ('briefing','analysis') ORDER BY a.published_at DESC LIMIT 30",
      )
    : [];
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="wrap py-8 md:py-10">
      {flags.welcome && ent.premium && (
        <div role="status" className="mb-6 rounded-lg bg-charcoal p-6 text-white">
          <p className="font-serif text-2xl font-bold">Welcome to Premium</p>
          <p className="mt-1 text-white/75">Unlimited Premium articles, the monthly analysis, the full archive and The Analyst Note are now yours.</p>
        </div>
      )}
      {flags.upgrade && <p className="mb-6 rounded-md bg-cream px-4 py-3">The Premium dashboard is for Premium members. <Link href="/membership?plan=premium&source=free_dashboard" className="font-semibold text-rust-text underline">Upgrade to Premium</Link></p>}
      {ent.pastDue && (
        <div role="alert" className="mb-6 flex flex-col gap-3 rounded-lg bg-[#f6e2e0] p-5 text-down sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">Your payment failed - update your card. Premium access continues until {formatDate(ent.graceEndsAt)}.</p>
          <form action={portalAction}><button className="btn btn-danger btn-sm">Update card</button></form>
        </div>
      )}
      {!user.email_confirmed_at && (
        <div className="mb-6 flex flex-col gap-2 rounded-md bg-cream px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>Please confirm your email address using the link we sent to {user.email}.</span>
          <form action={resendConfirmAction}><button className="font-semibold text-rust-text underline">Resend link</button></form>
        </div>
      )}
      {flags.confirmed && <p role="status" className="mb-6 rounded-md bg-[#e3efe6] px-4 py-3 text-sm text-up">Email confirmed. Thank you.</p>}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold md:text-4xl">
            {greeting}
            {user.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          {newCount > 0 && <p className="mt-1 text-muted">Since your last visit: {newCount} new {newCount === 1 ? "story" : "stories"}</p>}
        </div>
        <span className={`eyebrow rounded px-3 py-1.5 ${ent.premium ? "bg-charcoal text-white" : "bg-white text-ink ring-1 ring-line"}`}>
          {ent.premium ? "Premium" : "Free"}
          {ent.source === "comp" ? " · complimentary" : ""}
        </span>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card title={`This week · ${edition.week_label}`}>
            {thisWeek.length ? <ul>{thisWeek.map((a) => <StoryLink key={a.id} a={a} />)}</ul> : <p className="text-muted">Nothing published yet this week.</p>}
          </Card>
          <div className="grid gap-6 md:grid-cols-2">
            {briefing && (
              <Card title="Latest briefing">
                <Link href={`/news/${briefing.slug}`} className="font-serif text-lg font-semibold hover:text-rust-text">{briefing.headline}</Link>
                <p className="mt-2 text-sm text-muted">{briefing.standfirst}</p>
              </Card>
            )}
            {analysis && (
              <Card title="Latest monthly analysis">
                <Link href={`/news/${analysis.slug}`} className="font-serif text-lg font-semibold hover:text-rust-text">{analysis.headline}</Link>
                <div className="mt-2"><PremiumTag /></div>
              </Card>
            )}
          </div>

          {ent.premium && (
            <>
              {s.show_deal_tracker && <DealTable deals={latestDeals(10)} subtitle="Full detail" />}
              {s.show_regulatory_pipeline && <DecisionTable items={latestDecisions(10)} />}
              <Card title="Archive: briefings and analysis">
                <ul>{archive.map((a) => <StoryLink key={a.id} a={a} />)}</ul>
              </Card>
            </>
          )}

          {!ent.premium && (
            <Card title="Free and Premium">
              <table className="table">
                <thead><tr><th scope="col"></th><th scope="col">Free</th><th scope="col">Premium</th></tr></thead>
                <tbody>
                  <tr><td>Daily stories and weekly briefing</td><td>Yes</td><td>Yes</td></tr>
                  <tr><td>Premium articles</td><td>3 a month</td><td>Unlimited</td></tr>
                  <tr><td>Monthly analysis</td><td>Within your 3</td><td>Yes</td></tr>
                  <tr><td>Companies you can follow</td><td>3</td><td>25</td></tr>
                  <tr><td>Full tracker detail and archive</td><td>No</td><td>Yes</td></tr>
                  <tr><td>The Analyst Note</td><td>No</td><td>Yes</td></tr>
                </tbody>
              </table>
              {s.show_paid_tiers && <Link href="/membership?plan=premium&source=free_dashboard" className="btn btn-primary mt-5">Upgrade to Premium</Link>}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {!ent.premium && (
            <Card title="Premium reads this month">
              <p className="font-serif text-3xl font-bold">{Math.min(reads, FREE_PREMIUM_READS)} <span className="text-lg font-normal text-muted">of {FREE_PREMIUM_READS}</span></p>
              <div className="mt-3 h-2 rounded bg-cream" role="progressbar" aria-valuemin={0} aria-valuemax={FREE_PREMIUM_READS} aria-valuenow={reads}>
                <div className="h-2 rounded bg-rust" style={{ width: `${Math.min(100, (reads / FREE_PREMIUM_READS) * 100)}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted">Resets on the 1st.</p>
            </Card>
          )}

          <Card title={`Companies you follow · ${followed.length} of ${ent.watchlistLimit}`}>
            {flags.limit && <p role="alert" className="mb-3 rounded bg-cream px-3 py-2 text-sm">You&apos;ve reached the {ent.watchlistLimit}-company limit on your plan.{!ent.premium && " Premium members can follow 25."}</p>}
            <ul>
              {followed.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 border-b border-line py-3 last:border-0">
                  <div className="min-w-0">
                    <Link href={`/companies/${c.slug}`} className="font-semibold hover:text-rust-text">{c.name}</Link>
                    {c.latest_slug ? (
                      <Link href={`/news/${c.latest_slug}`} className="mt-0.5 block truncate text-sm text-muted hover:underline">{c.latest}</Link>
                    ) : c.deal ? (
                      <p className="mt-0.5 text-sm text-muted">{c.deal}</p>
                    ) : null}
                  </div>
                  <form action={followCompanyAction}>
                    <input type="hidden" name="company_id" value={c.id} />
                    <input type="hidden" name="follow" value="0" />
                    <input type="hidden" name="back" value={back} />
                    <button className="text-xs text-muted underline" aria-label={`Unfollow ${c.name}`}>Unfollow</button>
                  </form>
                </li>
              ))}
            </ul>
            {followable.length > 0 && (
              <form action={followCompanyAction} className="mt-4 flex gap-2">
                <input type="hidden" name="follow" value="1" />
                <input type="hidden" name="back" value={back} />
                <label htmlFor="follow-co" className="sr-only">Company to follow</label>
                <select id="follow-co" name="company_id" className="input py-2 text-sm">
                  {followable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button className="btn btn-dark btn-sm shrink-0">Follow</button>
              </form>
            )}
          </Card>

          <Card title="Newsletters">
            <ul className="space-y-3">
              {newsletters.map((n) => {
                const on = nlStatus.some((x) => x.slug === n.slug && x.status === "confirmed");
                return (
                  <li key={n.slug} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{n.name}</p>
                      <p className="text-xs text-muted">{n.cadence}</p>
                    </div>
                    <form action={newsletterToggleAction}>
                      <input type="hidden" name="slug" value={n.slug} />
                      <input type="hidden" name="on" value={on ? "0" : "1"} />
                      <input type="hidden" name="back" value={back} />
                      <button role="switch" aria-checked={on} aria-label={`${n.name} ${on ? "on" : "off"}`} className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-rust" : "bg-[#cfc8bb]"}`}>
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-[1.4rem]" : "left-0.5"}`} />
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Plan and billing">
            <p className="font-semibold">{ent.premium ? "Premium" : "Free"}{ent.subscription && ent.premium ? ` · ${ent.subscription.interval === "year" ? "annual" : "monthly"}` : ""}</p>
            {ent.renewal && <p className="text-sm text-muted">{ent.subscription?.cancel_at_period_end ? "Ends" : ent.source === "comp" ? "Complimentary until" : "Renews"} {formatDate(ent.renewal)}</p>}
            {ent.source === "comp" && !ent.renewal && <p className="text-sm text-muted">Complimentary access</p>}
            {ent.subscription ? (
              <form action={portalAction}><button className="btn btn-outline btn-sm mt-4">Manage billing</button></form>
            ) : !ent.premium && s.show_paid_tiers ? (
              <Link href="/membership?plan=premium&source=free_dashboard" className="btn btn-primary btn-sm mt-4">Upgrade</Link>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
