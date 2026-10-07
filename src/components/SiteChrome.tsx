import Link from "next/link";
import { Wordmark } from "./Wordmark";
import { NavLinks, RebrandBar, CookieBanner, CookieSettingsLink, SearchShortcut } from "./client";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";
import { getOrCreateCurrentEdition } from "@/lib/content";
import { stripeMode } from "@/lib/billing";
import { utilityDate } from "@/lib/time";

export const COMPLIANCE_NOTICE =
  "MedTwenty Indices and trackers are editorial indicators and business information. They are not investment, financial, legal or medical advice, and not a regulated benchmark.";

export function navItems(s: ReturnType<typeof getSettings>) {
  const items = [
    { href: "/", label: "Home" },
    { href: "/news", label: "News" },
    { href: "/news/briefings", label: "Briefings" },
    { href: "/news/analysis", label: "Analysis" },
  ];
  if (s.show_deal_tracker) items.push({ href: "/deals", label: "Deal Tracker" });
  if (s.show_regulatory_pipeline) items.push({ href: "/regulatory", label: "Regulatory" });
  if (s.show_intelligence_nav) items.push({ href: "/companies", label: "Intelligence" });
  if (s.show_research_centre) items.push({ href: "/research", label: "Research" });
  items.push({ href: "/membership", label: "Membership" });
  return items;
}

export async function SiteHeader() {
  const s = getSettings();
  const user = await currentUser();
  const ent = entitlementFor(user);
  const edition = getOrCreateCurrentEdition();
  const dash = ent.premium ? "/premium-dashboard" : "/dashboard";
  const editions = [{ label: "United Kingdom", on: true }];
  if (s.show_us_edition) editions.push({ label: "United States", on: false });
  if (s.show_canada_edition) editions.push({ label: "Canada", on: false });
  const testMode = stripeMode() !== "live";

  return (
    <header>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SearchShortcut />
      <div className="bg-charcoal text-[0.8rem] text-white/75">
        <div className="wrap flex items-center justify-between gap-4">
          <div className="flex items-center overflow-x-auto whitespace-nowrap">
            <span className="eyebrow hidden py-3 pr-5 font-medium text-white/65 sm:inline">{utilityDate()}</span>
            {editions.map((e) => (
              <span key={e.label} className={`eyebrow px-4 py-3 ${e.on ? "bg-charcoal-2 text-white" : "text-white/65"}`}>
                {e.label}
              </span>
            ))}
            <span className="eyebrow py-3 pl-4 text-white/65">{edition.week_label}</span>
          </div>
          <nav aria-label="Utility" className="flex items-center gap-5 whitespace-nowrap py-3 text-[0.9rem]">
            {s.show_indices_strip && <Link href="/indices" className="hidden hover:text-white md:inline">MedTwenty Indices</Link>}
            {s.show_api_page && <Link href="/api-access" className="hidden hover:text-white md:inline">API</Link>}
            <Link href="/newsletters" className="hidden hover:text-white sm:inline">
              Newsletters
            </Link>
            {user ? (
              <Link href={dash} className="font-semibold text-white">
                My dashboard
              </Link>
            ) : (
              <Link href="/login" className="font-semibold text-white">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </div>

      <div className="border-b border-line bg-white">
        <div className="wrap flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between md:py-8">
          <div>
            <Wordmark />
            <p className="eyebrow mt-2 font-medium text-[#3b3e45]">{s.descriptor}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <form action="/search" role="search" className="relative sm:w-[22rem] lg:w-[34rem]">
              <label htmlFor="site-search" className="sr-only">
                Search MedTwenty
              </label>
              <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <circle cx="9" cy="9" r="6" />
                <path d="M14 14l4 4" />
              </svg>
              <input id="site-search" name="q" type="search" placeholder="Search stories, companies, deals" className="input h-12 pl-11 pr-14" />
              <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 text-[0.7rem] text-muted sm:block">⌘K</kbd>
            </form>
            {user ? (
              <Link href={dash} className="btn btn-primary h-12 px-6 text-base">
                {ent.premium ? "Premium dashboard" : "My dashboard"}
              </Link>
            ) : (
              <Link href="/signup" className="btn btn-primary h-12 px-6 text-base">
                Create free account
              </Link>
            )}
          </div>
        </div>
      </div>

      <nav aria-label="Main" className="border-b border-line bg-white">
        <div className="wrap">
          <NavLinks items={navItems(s)} />
        </div>
      </nav>

      {testMode && (
        <div className="border-b border-[#e8dcc8] bg-cream text-center text-sm text-ink">
          <p className="wrap py-2">Payments on this preview are in test mode. Use card 4242 4242 4242 4242.</p>
        </div>
      )}
      {s.rebrand_notice && <RebrandBar />}
    </header>
  );
}

export function SiteFooter() {
  const s = getSettings();
  const year = new Date().getFullYear();
  const cols: { title: string; links: { href: string; label: string }[] }[] = [
    {
      title: "Read",
      links: [
        { href: "/news", label: "Latest news" },
        { href: "/news/briefings", label: "Weekly briefings" },
        { href: "/news/analysis", label: "Monthly analysis" },
        ...(s.show_deal_tracker ? [{ href: "/deals", label: "Deal Flow Tracker" }] : []),
        ...(s.show_regulatory_pipeline ? [{ href: "/regulatory", label: "Regulatory Pipeline" }] : []),
      ],
    },
    {
      title: "MedTwenty",
      links: [
        { href: "/about", label: "About" },
        { href: "/editorial-standards", label: "Editorial standards" },
        { href: "/membership", label: "Membership" },
        { href: "/newsletters", label: "Newsletters" },
        { href: "/contact", label: "Contact" },
      ],
    },
    {
      title: "Legal",
      links: [
        { href: "/privacy", label: "Privacy" },
        { href: "/terms", label: "Terms" },
        { href: "/cookies", label: "Cookies" },
        { href: "/accessibility", label: "Accessibility" },
      ],
    },
  ];
  return (
    <footer className="mt-20 bg-charcoal text-white/75">
      <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Wordmark dark size="md" />
          <p className="eyebrow mt-2 text-white/60">{s.descriptor}</p>
          <p className="mt-5 max-w-sm font-serif text-lg italic text-white/85">{s.tagline}</p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="eyebrow mb-4 text-white/55">{c.title}</h2>
            <ul className="space-y-2.5 text-[0.95rem]">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
              {c.title === "Legal" && (
                <li>
                  <CookieSettingsLink />
                </li>
              )}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="wrap space-y-2 py-6 text-[0.8rem] text-white/60">
          <p>{COMPLIANCE_NOTICE}</p>
          <p>
            © {year} {s.company_name}. MedTwenty is a trading name of {s.company_name}. {s.company_address}.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function PublicChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
      <CookieBanner />
    </>
  );
}
