import Link from "next/link";
import type { Article, Deal, RegDecision } from "@/lib/content";
import { dealLabel } from "@/lib/content";
import { PremiumTag, Arrow } from "./Wordmark";
import { CONTENT_TYPE_LABEL } from "@/lib/format";
import { formatDate } from "@/lib/time";

export function HeroImage({ a, className = "", priority = false, sizes }: { a: Article; className?: string; priority?: boolean; sizes?: string }) {
  if (a.hero_image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={a.hero_image_url}
        alt={a.hero_alt || ""}
        width={1000}
        height={560}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }
  // No licensed image yet: a quiet branded panel rather than a broken image.
  return (
    <div className={`flex h-full w-full items-end bg-[linear-gradient(135deg,#efe4d3_0%,#e2cdb1_55%,#c99a72_100%)] p-5 ${className}`} aria-hidden="true">
      <span className="font-serif text-2xl font-bold text-[#7a3d17]/40">
        Med<span className="text-[#7a3d17]/60">Twenty</span>
      </span>
    </div>
  );
}

export function TypeLabel({ a, dark = false }: { a: Article; dark?: boolean }) {
  return (
    <span className={`eyebrow ${dark ? "text-rust-light" : "text-rust-text"}`}>
      {a.content_type === "story" ? a.category_name : CONTENT_TYPE_LABEL[a.content_type]}
    </span>
  );
}

export function ArticleCard({ a }: { a: Article }) {
  return (
    <article className="group card flex flex-col overflow-hidden">
      <Link href={`/news/${a.slug}`} className="block aspect-[4/3] overflow-hidden" tabIndex={-1} aria-hidden="true">
        <HeroImage a={a} className="transition-transform duration-300 group-hover:scale-[1.02]" sizes="(min-width: 1024px) 380px, 100vw" />
      </Link>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center justify-between gap-3">
          <TypeLabel a={a} />
          {!!a.is_premium && <PremiumTag />}
        </div>
        <h3 className="mt-3 font-serif text-[1.35rem] font-semibold leading-snug">
          <Link href={`/news/${a.slug}`} className="hover:text-rust-text">
            {a.headline}
          </Link>
        </h3>
        <p className="mt-auto pt-4 text-sm text-muted">{formatDate(a.published_at, { weekday: "long", day: "numeric", month: "long", year: undefined })}</p>
      </div>
    </article>
  );
}

export function ArticleRow({ a, showDate = true }: { a: Article; showDate?: boolean }) {
  return (
    <article className="flex gap-5 border-b border-line py-6">
      <Link href={`/news/${a.slug}`} className="hidden aspect-[4/3] w-44 shrink-0 overflow-hidden rounded sm:block" tabIndex={-1} aria-hidden="true">
        <HeroImage a={a} />
      </Link>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <TypeLabel a={a} />
          {a.content_type !== "story" && a.category_name && <span className="text-xs text-muted">{a.category_name}</span>}
          {!!a.is_premium && <PremiumTag />}
        </div>
        <h3 className="mt-2 font-serif text-xl font-semibold leading-snug md:text-[1.4rem]">
          <Link href={`/news/${a.slug}`} className="hover:text-rust-text">
            {a.headline}
          </Link>
        </h3>
        {a.standfirst && <p className="mt-2 line-clamp-2 text-[#3b3e45]">{a.standfirst}</p>}
        {showDate && (
          <p className="mt-2 text-sm text-muted">
            {formatDate(a.published_at)}
            {a.author_name ? ` · ${a.author_name}` : ""}
          </p>
        )}
      </div>
    </article>
  );
}

const STATUS_STYLE: Record<string, string> = {
  announced: "bg-[#efe9df] text-[#4a4d55]",
  closed: "bg-[#efe9df] text-[#4a4d55]",
  rumoured: "bg-[#efe9df] text-[#4a4d55]",
  approved: "bg-[#e3efe6] text-up",
  rejected: "bg-[#f6e2e0] text-down",
  pending: "bg-[#efe9df] text-[#4a4d55]",
  guidance: "bg-[#e9e7f3] text-[#4a4580]",
};

export function StatusPill({ status }: { status: string }) {
  return <span className={`eyebrow rounded px-2.5 py-1 text-[0.68rem] ${STATUS_STYLE[status] || STATUS_STYLE.pending}`}>{status}</span>;
}

export function DealTable({ deals, title = "Deal Flow Tracker", subtitle, footer = true, locked = false }: { deals: Deal[]; title?: string; subtitle?: string; footer?: boolean; locked?: boolean }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between bg-charcoal px-5 py-5 text-white md:px-8">
        <h3 className="font-serif text-xl font-semibold md:text-2xl">{title}</h3>
        {subtitle && <span className="eyebrow hidden text-white/65 sm:inline">{subtitle}</span>}
      </div>
      <ul>
        {deals.map((d) => (
          <li key={d.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-line px-5 py-4 md:grid-cols-[1.4fr_1fr_auto] md:px-8 md:py-5">
            <div className="min-w-0">
              {d.article_slug ? (
                <Link href={`/news/${d.article_slug}`} className="font-medium hover:text-rust-text md:text-lg">
                  {dealLabel(d)}
                </Link>
              ) : (
                <span className="font-medium md:text-lg">{dealLabel(d)}</span>
              )}
              {d.round && <span className="ml-2 text-sm text-up">{d.round}</span>}
            </div>
            <span className="order-3 text-sm text-muted md:order-none md:text-center md:text-base">{d.sector}</span>
            <div className="row-span-2 flex items-center justify-end gap-3 md:row-span-1">
              <span className="font-serif text-lg font-semibold md:text-2xl">{locked ? "—" : d.value_text || "Undisclosed"}</span>
              <StatusPill status={d.status} />
            </div>
          </li>
        ))}
      </ul>
      {footer && (
        <div className="bg-cream-2 py-4 text-center">
          <Link href="/deals" className="font-semibold text-rust-text hover:underline">
            Open tracker <Arrow />
          </Link>
        </div>
      )}
    </div>
  );
}

export function DecisionTable({ items, footer = true }: { items: RegDecision[]; footer?: boolean }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between bg-charcoal px-5 py-5 text-white md:px-8">
        <h3 className="font-serif text-xl font-semibold md:text-2xl">Regulatory Pipeline</h3>
        <span className="eyebrow hidden text-white/65 sm:inline">{items.length} latest verified decisions</span>
      </div>
      <ul>
        {items.map((r) => (
          <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line px-5 py-4 md:grid-cols-[1.4fr_0.6fr_auto] md:px-8 md:py-5">
            <div className="min-w-0">
              {r.article_slug ? (
                <Link href={`/news/${r.article_slug}`} className="font-medium hover:text-rust-text md:text-lg">
                  {r.product}
                </Link>
              ) : (
                <span className="font-medium md:text-lg">{r.product}</span>
              )}
              {r.company && <span className="ml-2 text-sm text-muted">{r.company}</span>}
            </div>
            <span className="hidden text-muted md:block">{r.regulator}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted md:hidden">{r.regulator}</span>
              <StatusPill status={r.decision} />
            </div>
          </li>
        ))}
      </ul>
      {footer && (
        <div className="bg-cream-2 py-4 text-center">
          <Link href="/regulatory" className="font-semibold text-rust-text hover:underline">
            Open pipeline <Arrow />
          </Link>
        </div>
      )}
    </div>
  );
}

export function SectionHead({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4 border-b-2 border-ink pb-4">
      <div>
        {eyebrow && <p className="eyebrow mb-2 text-rust-text">{eyebrow}</p>}
        <h2 className="font-serif text-3xl font-bold md:text-[2.4rem]">{title}</h2>
      </div>
      {action}
    </div>
  );
}
