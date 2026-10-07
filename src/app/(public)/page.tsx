import Link from "next/link";
import {
  activeNewsletters,
  briefingItems,
  countInEdition,
  getOrCreateCurrentEdition,
  latestDecisions,
  latestDeals,
  latestOfType,
  latestPublished,
  mostReadThisMonth,
  previousEdition,
  publishedCount,
  publishedInEdition,
} from "@/lib/content";
import { getSettings, appUrl } from "@/lib/settings";
import { all } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";
import { ArticleCard, DealTable, DecisionTable, HeroImage, SectionHead, TypeLabel } from "@/components/cards";
import { Arrow, PremiumTag } from "@/components/Wordmark";
import { NewsletterForm } from "@/components/NewsletterForm";
import { COMPLIANCE_NOTICE } from "@/components/SiteChrome";
import { excerpt } from "@/lib/format";
import { formatDate } from "@/lib/time";

export default async function HomePage() {
  const s = getSettings();
  const user = await currentUser();
  const ent = entitlementFor(user);
  const edition = getOrCreateCurrentEdition();
  const n = countInEdition(edition.id);
  const lead = latestPublished(["story", "analysis"]);

  // This week: other pieces in the current edition, newest first (up to 6).
  const thisWeek = publishedInEdition(edition.id).filter((a) => a.id !== lead?.id).slice(0, 6);
  const prev = previousEdition(edition);
  const lastWeek =
    thisWeek.length < 3 && prev
      ? publishedInEdition(prev.id, ["story"])
          .filter((a) => a.id !== lead?.id)
          .slice(0, 6 - thisWeek.length)
      : [];

  const briefing = latestOfType("briefing");
  const briefItems = briefing ? briefingItems(briefing.id) : [];
  const analysis = latestOfType("analysis");
  const deals = s.show_deal_tracker ? latestDeals(5) : [];
  const decisions = s.show_regulatory_pipeline ? latestDecisions(5) : [];
  const mostRead = publishedCount() >= 10 ? mostReadThisMonth() : [];
  const newsletters = activeNewsletters();
  const indices = s.show_indices_strip ? all<{ id: number; name: string; value: number; change_pct: number }>("SELECT * FROM indices WHERE is_public = 1") : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "MedTwenty", url: "https://medtwenty.com", logo: "https://medtwenty.com/icon.svg", parentOrganization: { "@type": "Organization", name: s.company_name } },
      {
        "@type": "WebSite",
        name: "MedTwenty",
        url: "https://medtwenty.com",
        potentialAction: { "@type": "SearchAction", target: `${appUrl()}/search?q={query}`, "query-input": "required name=query" },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Edition bar + lead in the dark editorial treatment */}
      <section className="bg-charcoal text-white" aria-labelledby="lead-heading">
        <div className="border-b border-white/10">
          <div className="wrap flex flex-col gap-1 py-5 md:flex-row md:items-center md:justify-between">
            <p className="eyebrow text-white">
              {edition.week_label} · {n} {n === 1 ? "story" : "stories"} this week
            </p>
            <p className="font-serif text-lg italic text-white/70">{s.tagline}</p>
          </div>
        </div>

        {lead && (
          <article className="wrap grid items-center gap-8 py-10 md:py-16 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
            <Link href={`/news/${lead.slug}`} className="block aspect-[16/10] overflow-hidden rounded-md" tabIndex={-1} aria-hidden="true">
              <HeroImage a={lead} priority sizes="(min-width: 1024px) 640px, 100vw" />
            </Link>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="eyebrow rounded bg-down px-2.5 py-1 text-[0.7rem] text-white">Latest</span>
                <TypeLabel a={lead} dark />
                {!!lead.is_premium && <PremiumTag className="!text-rust-light" />}
              </div>
              <h1 id="lead-heading" className="mt-5 font-serif text-[2.1rem] font-bold leading-[1.1] md:text-[3rem]">
                <Link href={`/news/${lead.slug}`} className="hover:text-white/85">
                  {lead.headline}
                </Link>
              </h1>
              {lead.standfirst && <p className="mt-6 text-lg leading-relaxed text-white/75">{lead.standfirst}</p>}
              <p className="mt-6 text-white/60">
                {lead.author_name}
                {lead.read_minutes ? ` · ${lead.read_minutes} min read` : ""}
              </p>
            </div>
          </article>
        )}

        {indices.length > 0 && (
          <div className="wrap border-t border-white/10 py-5">
            <div className="flex items-center gap-6 overflow-hidden">
              <span className="eyebrow shrink-0 border-r border-white/20 pr-6 text-white/60">MedTwenty Indices</span>
              <div className="flex gap-10 whitespace-nowrap">
                {indices.map((i) => (
                  <span key={i.id}>
                    {i.name} <span className="ml-2">{i.value.toFixed(1)}</span>{" "}
                    <span className={i.change_pct >= 0 ? "text-[#5fbf86]" : "text-[#ef7d74]"}>
                      {i.change_pct >= 0 ? "▲ +" : "▼ "}
                      {i.change_pct.toFixed(2)}%
                    </span>
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-3 text-xs text-white/55">{COMPLIANCE_NOTICE}</p>
          </div>
        )}
      </section>

      {/* This week */}
      {thisWeek.length > 0 && (
        <section className="wrap pt-16" aria-labelledby="this-week">
          <SectionHead
            eyebrow={edition.week_label}
            title="This week"
            action={
              <Link href="/news" className="hidden font-semibold text-rust-text hover:underline sm:inline">
                All news <Arrow />
              </Link>
            }
          />
          <h2 id="this-week" className="sr-only">
            This week
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {thisWeek.map((a) => (
              <ArticleCard key={a.id} a={a} />
            ))}
          </div>
        </section>
      )}

      {lastWeek.length > 0 && (
        <section className="wrap pt-16" aria-labelledby="last-week">
          <SectionHead eyebrow={prev?.week_label} title="Last week" />
          <h2 id="last-week" className="sr-only">
            Last week
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {lastWeek.map((a) => (
              <ArticleCard key={a.id} a={a} />
            ))}
          </div>
        </section>
      )}

      {/* The MedTwenty Weekly */}
      {briefing && (
        <section className="wrap pt-20" aria-labelledby="weekly">
          <div className="grid gap-8 rounded-lg bg-cream p-6 md:grid-cols-[1.2fr_1fr] md:p-12">
            <div>
              <p className="eyebrow text-rust-text">The MedTwenty Weekly · Every Friday</p>
              <h2 id="weekly" className="mt-3 font-serif text-3xl font-bold leading-tight md:text-4xl">
                <Link href={`/news/${briefing.slug}`} className="hover:text-rust-text">
                  {briefing.headline}
                </Link>
              </h2>
              <p className="mt-5 text-lg leading-relaxed text-[#33363d]">{excerpt(briefing.body, 70)}</p>
              <Link href={`/news/${briefing.slug}`} className="btn btn-dark mt-7">
                Read the briefing
              </Link>
            </div>
            {briefItems.length > 0 && (
              <ol className="space-y-0 self-start">
                {briefItems.map((a, i) => (
                  <li key={a.id} className="flex gap-4 border-b border-[#e3d8c6] py-4 last:border-0">
                    <span className="font-serif text-3xl font-bold text-rust">{i + 1}</span>
                    <div>
                      <Link href={`/news/${a.slug}`} className="font-serif text-lg font-semibold leading-snug hover:text-rust-text">
                        {a.headline}
                      </Link>
                      <div className="mt-1 flex items-center gap-3 text-sm text-rust-text">
                        {a.category_name}
                        {!!a.is_premium && <PremiumTag />}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}

      {/* Monthly analysis */}
      {analysis && (
        <section className="wrap pt-20" aria-labelledby="analysis">
          <SectionHead eyebrow="Original analysis · Monthly" title="Monthly analysis" />
          <article className="grid gap-8 md:grid-cols-2">
            <Link href={`/news/${analysis.slug}`} className="block aspect-[16/10] overflow-hidden rounded-md" tabIndex={-1} aria-hidden="true">
              <HeroImage a={analysis} />
            </Link>
            <div className="self-center">
              <div className="flex items-center gap-3">
                <span className="eyebrow text-rust-text">{formatDate(analysis.published_at, { day: undefined })}</span>
                {!!analysis.is_premium && <PremiumTag />}
              </div>
              <h2 id="analysis" className="mt-3 font-serif text-3xl font-bold leading-tight">
                <Link href={`/news/${analysis.slug}`} className="hover:text-rust-text">
                  {analysis.headline}
                </Link>
              </h2>
              {analysis.standfirst && <p className="mt-4 text-lg text-[#3b3e45]">{analysis.standfirst}</p>}
              <Link href={`/news/${analysis.slug}`} className="mt-6 inline-block font-semibold text-rust-text hover:underline">
                Read the analysis <Arrow />
              </Link>
            </div>
          </article>
        </section>
      )}

      {/* Trackers */}
      {(deals.length > 0 || decisions.length > 0) && (
        <section className="wrap pt-20" aria-labelledby="trackers">
          <div className="mb-6 flex items-center justify-between border-b border-line pb-3">
            <h2 id="trackers" className="eyebrow text-[#3b3e45]">
              Deal and regulatory highlights
            </h2>
          </div>
          <div className="space-y-10">
            {deals.length > 0 && <DealTable deals={deals} subtitle={`${deals.length} latest verified deals`} />}
            {decisions.length > 0 && <DecisionTable items={decisions} />}
          </div>
          <p className="mt-4 text-xs text-muted">{COMPLIANCE_NOTICE}</p>
        </section>
      )}

      {/* Newsletters */}
      {newsletters.length > 0 && (
        <section className="wrap pt-20" aria-labelledby="newsletters">
          <div className="rounded-lg bg-charcoal p-6 text-white md:p-12">
            <p className="eyebrow text-rust-light">Newsletters</p>
            <h2 id="newsletters" className="mt-3 font-serif text-3xl font-bold md:text-4xl">
              Get MedTwenty by email
            </h2>
            <p className="mb-8 mt-3 max-w-2xl text-white/70">The day&apos;s verified story, the Friday briefing and, for Premium members, the monthly Analyst Note.</p>
            <NewsletterForm newsletters={newsletters} source="homepage" dark defaultEmail={user?.email} premium={ent.premium} />
          </div>
        </section>
      )}

      {/* Most read */}
      {mostRead.length > 0 && (
        <section className="wrap pt-20" aria-labelledby="most-read">
          <SectionHead title="Most read this month" />
          <h2 id="most-read" className="sr-only">
            Most read this month
          </h2>
          <ol className="grid gap-x-10 md:grid-cols-2">
            {mostRead.map((a, i) => (
              <li key={a.id} className="flex gap-5 border-b border-line py-5">
                <span className="w-8 font-serif text-3xl font-bold text-rust">{i + 1}</span>
                <div>
                  <Link href={`/news/${a.slug}`} className="font-serif text-lg font-semibold leading-snug hover:text-rust-text">
                    {a.headline}
                  </Link>
                  <div className="mt-1 flex items-center gap-3 text-sm text-rust-text">
                    {a.category_name}
                    {!!a.is_premium && <PremiumTag />}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
