import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { articleBySlug, briefingItems, companiesForArticle, publishedCorrections } from "@/lib/content";
import { currentStaffSession, currentUser } from "@/lib/auth";
import { checkPremiumAccess, entitlementFor } from "@/lib/entitlements";
import { renderMarkdown } from "@/lib/markdown";
import { CONTENT_TYPE_LABEL, excerpt } from "@/lib/format";
import { formatDate, monthKey } from "@/lib/time";
import { HeroImage } from "@/components/cards";
import { Arrow, LockIcon, PremiumTag } from "@/components/Wordmark";
import { MeterMark } from "@/components/client";
import { getSettings } from "@/lib/settings";
import { priceLabel } from "@/lib/billing";
import { planByCode } from "@/lib/content";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

function isLive(a: { status: string; published_at: string | null } | undefined) {
  return !!a && a.status === "published" && !!a.published_at && a.published_at <= new Date().toISOString();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = articleBySlug((await params).slug);
  if (!isLive(a)) return { title: "Not found" };
  const title = (a!.seo_title || a!.headline).slice(0, 60);
  const description = (a!.seo_description || a!.standfirst || excerpt(a!.body, 30)).slice(0, 155);
  const og = `/og?title=${encodeURIComponent(a!.headline)}`;
  return {
    title,
    description,
    alternates: { canonical: `https://medtwenty.com/news/${a!.slug}` },
    openGraph: { type: "article", title, description, publishedTime: a!.published_at || undefined, images: [a!.hero_image_url || og] },
    twitter: { card: "summary_large_image", title, description, images: [a!.hero_image_url || og] },
  };
}

export default async function ArticlePage({ params, searchParams }: Props) {
  const a = articleBySlug((await params).slug);
  // Staff can preview unpublished pieces in the public template.
  const preview = (await searchParams).preview === "1" && !!(await currentStaffSession())?.roles.length;
  if (!a || (!isLive(a) && !preview)) notFound();

  const user = await currentUser();
  const ent = entitlementFor(user);
  const access = a.is_premium && !preview ? await checkPremiumAccess(user, ent, a.id) : { allowed: true, used: 0, limit: 0, anonymous: !user };
  const items = a.content_type === "briefing" ? briefingItems(a.id) : [];
  const companies = companiesForArticle(a.id);
  const corrections = publishedCorrections(a.id);
  const s = getSettings();
  const premium = planByCode("premium");

  const bodyHtml = renderMarkdown(access.allowed ? a.body : a.body.split(/\n{2,}/).slice(0, 2).join("\n\n"));

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        headline: a.headline,
        description: a.standfirst || undefined,
        datePublished: a.published_at,
        dateModified: a.updated_at,
        author: a.author_name ? { "@type": "Person", name: a.author_name } : undefined,
        image: a.hero_image_url ? [a.hero_image_url] : undefined,
        articleSection: a.category_name || undefined,
        publisher: { "@type": "Organization", name: "MedTwenty", logo: { "@type": "ImageObject", url: "https://medtwenty.com/icon.svg" } },
        mainEntityOfPage: `https://medtwenty.com/news/${a.slug}`,
        isAccessibleForFree: !a.is_premium,
        ...(a.is_premium ? { hasPart: { "@type": "WebPageElement", isAccessibleForFree: false, cssSelector: ".article-body" } } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "News", item: "https://medtwenty.com/news" },
          ...(a.category_slug ? [{ "@type": "ListItem", position: 2, name: a.category_name, item: `https://medtwenty.com/news/category/${a.category_slug}` }] : []),
          { "@type": "ListItem", position: a.category_slug ? 3 : 2, name: a.headline },
        ],
      },
    ],
  };

  return (
    <article className="pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {access.allowed && access.anonymous && !!a.is_premium && <MeterMark articleId={a.id} month={monthKey()} />}

      <header className="wrap max-w-[860px] pt-10 md:pt-14">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted">
          <Link href="/news" className="hover:text-rust-text">
            News
          </Link>
          {a.category_slug && (
            <>
              {" / "}
              <Link href={`/news/category/${a.category_slug}`} className="hover:text-rust-text">
                {a.category_name}
              </Link>
            </>
          )}
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow rounded bg-cream px-2.5 py-1 text-[0.7rem] text-ink">{CONTENT_TYPE_LABEL[a.content_type]}</span>
          {a.category_name && <span className="eyebrow text-rust-text">{a.category_name}</span>}
          {!!a.is_premium && <PremiumTag />}
        </div>
        <h1 className="mt-4 font-serif text-[2rem] font-bold leading-[1.12] md:text-[3rem]">{a.headline}</h1>
        {a.standfirst && <p className="mt-5 text-xl leading-relaxed text-[#3b3e45]">{a.standfirst}</p>}
        <p className="mt-6 border-b border-line pb-6 text-sm text-muted">
          {a.author_name && <span className="font-medium text-ink">{a.author_name}</span>}
          {a.author_name && " · "}
          {a.published_at ? <time dateTime={a.published_at}>{formatDate(a.published_at)}</time> : <span>Preview: not published</span>}
          {a.read_minutes ? ` · ${a.read_minutes} min read` : ""}
        </p>
      </header>

      {a.hero_image_url && (
        <figure className="wrap mt-8 max-w-[1040px]">
          <div className="aspect-[16/9] overflow-hidden rounded-md">
            <HeroImage a={a} priority sizes="(min-width: 1040px) 1040px, 100vw" />
          </div>
        </figure>
      )}

      <div className="wrap mt-10 max-w-[760px]">
        {access.allowed && !!a.is_premium && !ent.premium && (
          <p className="mb-8 rounded-md bg-cream px-4 py-3 text-sm">
            {access.anonymous
              ? "You're reading your free Premium article this month. "
              : `Premium article ${access.used} of ${access.limit} this month on your free plan. `}
            <Link href={access.anonymous ? "/signup" : "/membership?plan=premium"} className="font-semibold text-rust-text underline">
              {access.anonymous ? "Create a free account for 3 a month" : "Go unlimited with Premium"}
            </Link>
          </p>
        )}

        <div className={`article-body prose-mt ${access.allowed ? "" : "relative max-h-80 overflow-hidden"}`}>
          <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          {!access.allowed && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white to-transparent" />}
        </div>

        {!access.allowed && (
          <div className="mt-6 rounded-lg border-2 border-charcoal p-6 text-center md:p-10" role="region" aria-label="Premium article">
            <p className="tag-premium justify-center">
              <LockIcon /> Premium
            </p>
            {access.anonymous ? (
              <>
                <h2 className="mt-3 font-serif text-2xl font-bold md:text-3xl">Create a free account to keep reading</h2>
                <p className="mx-auto mt-3 max-w-lg text-[#3b3e45]">Free members read three Premium articles a month, plus every free story and the Friday briefing.</p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link href={`/signup?redirect=/news/${a.slug}`} className="btn btn-primary">
                    Create free account
                  </Link>
                  <Link href={`/login?redirect=/news/${a.slug}`} className="btn btn-outline">
                    Sign in
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-3 font-serif text-2xl font-bold md:text-3xl">You&apos;ve read your 3 free Premium articles this month</h2>
                <p className="mx-auto mt-3 max-w-lg text-[#3b3e45]">
                  Premium gives you unlimited editorial analysis, the monthly analysis and the full archive
                  {premium && s.show_paid_tiers ? ` for ${priceLabel(premium, "month")} a month` : ""}. Your allowance resets on the 1st.
                </p>
                {s.show_paid_tiers && (
                  <Link href={`/membership?plan=premium&source=article_paywall`} className="btn btn-primary mt-6">
                    Upgrade to Premium
                  </Link>
                )}
              </>
            )}
          </div>
        )}

        {access.allowed && a.why_it_matters && (
          <aside className="mt-10 border-l-4 border-rust bg-cream-2 p-6">
            <h2 className="eyebrow text-rust-text">Why it matters</h2>
            <p className="mt-2 font-serif text-lg leading-relaxed">{a.why_it_matters}</p>
          </aside>
        )}

        {items.length > 0 && (
          <section className="mt-12" aria-labelledby="in-this-briefing">
            <h2 id="in-this-briefing" className="border-b-2 border-ink pb-3 font-serif text-2xl font-bold">
              {items.length < 5 ? `A shorter week: ${items.length} developments that matter` : "The five developments that mattered"}
            </h2>
            <ol>
              {items.map((it, i) => (
                <li key={it.id} className="flex gap-5 border-b border-line py-5">
                  <span className="font-serif text-3xl font-bold text-rust">{i + 1}</span>
                  <div>
                    <Link href={`/news/${it.slug}`} className="font-serif text-xl font-semibold leading-snug hover:text-rust-text">
                      {it.headline}
                    </Link>
                    {it.standfirst && <p className="mt-1 text-[#3b3e45]">{it.standfirst}</p>}
                    <div className="mt-1 flex items-center gap-3 text-sm text-rust-text">
                      {it.category_name}
                      {!!it.is_premium && <PremiumTag />}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {access.allowed && a.source_outlet && (
          <p className="mt-10 border-t border-line pt-5 text-sm text-muted">
            <span className="font-semibold text-ink">Source:</span> {a.source_outlet}
            {a.source_url && (
              <>
                {" · "}
                <a href={a.source_url} rel="noopener noreferrer" target="_blank" className="text-rust-text underline">
                  Read the original
                </a>
              </>
            )}
          </p>
        )}

        {corrections.length > 0 && (
          <section className="mt-8 rounded-md border border-line p-5" aria-label="Corrections">
            <h2 className="eyebrow text-ink">Corrections</h2>
            {corrections.map((c) => (
              <p key={c.id} className="mt-2 text-sm">
                <span className="text-muted">{formatDate(c.created_at)}:</span> {c.note}
              </p>
            ))}
          </section>
        )}

        {companies.length > 0 && (
          <section className="mt-8" aria-label="Companies in this story">
            <h2 className="eyebrow text-muted">Companies in this story</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {companies.map((c) => (
                <li key={c.id}>
                  <Link href={`/companies/${c.slug}`} className="inline-block rounded-full border border-line px-3 py-1 text-sm hover:border-rust hover:text-rust-text">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12 rounded-lg bg-charcoal p-6 text-white">
          <p className="font-serif text-xl font-semibold">Get the day&apos;s verified story by email</p>
          <p className="mt-1 text-white/70">The Daily Story, every weekday when it&apos;s published. Free.</p>
          <Link href="/newsletters" className="mt-4 inline-block font-semibold text-rust-light hover:underline">
            Choose newsletters <Arrow />
          </Link>
        </div>
      </div>
    </article>
  );
}
