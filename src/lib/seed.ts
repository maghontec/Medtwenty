import type { DatabaseSync } from "node:sqlite";
import { addDays, weekLabel, weekStart } from "./time";
import { DEFAULT_SETTINGS } from "./settings-defaults";
import { LEGAL_DEFAULTS } from "./legal-defaults";

// Sample data so a fresh install looks like a working publication. Every row
// that represents content carries source = 'seed' so "Remove all sample data"
// (Control Room > Launch) can delete it in one go.

const ACTIVE_CATEGORIES: [string, string, string][] = [
  ["nhs-healthcare-finance", "NHS & Healthcare Finance", "Budgets, deficits, commissioning and the money behind NHS services."],
  ["healthcare-companies", "Healthcare Companies", "Private providers, hospital groups, operators and the companies that serve them."],
  ["healthcare-technology", "Healthcare Technology", "Digital health, AI, diagnostics, medtech, pharma and biotech."],
  ["regulation-policy", "Regulation & Policy", "MHRA, NICE, CQC, DHSC and the rules that shape the market."],
  ["investment-markets", "Investment & Markets", "M&A, venture capital, private equity and public markets."],
];

// The 14 original categories: kept, inactive, redirecting to their new home.
const LEGACY_CATEGORIES: [string, string, string][] = [
  ["nhs-policy", "NHS & Policy", "regulation-policy"],
  ["private-healthcare", "Private Healthcare", "healthcare-companies"],
  ["healthcare-business", "Healthcare Business", "healthcare-companies"],
  ["hospitals", "Hospitals", "healthcare-companies"],
  ["digital-health", "Digital Health", "healthcare-technology"],
  ["medtech-devices", "MedTech & Devices", "healthcare-technology"],
  ["healthcare-ai", "Healthcare AI", "healthcare-technology"],
  ["diagnostics", "Diagnostics", "healthcare-technology"],
  ["precision-medicine", "Precision Medicine", "healthcare-technology"],
  ["pharma-biotech", "Pharma & Biotech", "healthcare-technology"],
  ["finance-ma", "Finance & M&A", "investment-markets"],
  ["vc-pe", "Venture Capital & Private Equity", "investment-markets"],
  ["workforce-careers", "Workforce & Careers", "nhs-healthcare-finance"],
  ["global-markets", "Global Markets", "investment-markets"],
];

type SeedArticle = {
  slug: string;
  headline: string;
  standfirst: string;
  body: string;
  why: string;
  outlet: string;
  url: string;
  cat: string;
  legacy: string;
  premium?: boolean;
  image?: string;
  alt?: string;
  week: 0 | -1 | -2;
  day: number; // 0 = Monday
  minutes: number;
  author: string;
  facts: [string, string][];
  pick?: boolean;
};

const ARTICLES: SeedArticle[] = [
  {
    slug: "tempus-acquires-personalis-1-5bn-cancer-genomics",
    headline: "Tempus acquires Personalis in $1.5bn deal, deepening push into cancer genomics",
    standfirst:
      "The AI-diagnostics firm absorbs its oncology genomics partner three years after their initial collaboration, and sets up a direct contest with Foundation Medicine for NHS pathology contracts.",
    body: `## What happened

Tempus has agreed to acquire Personalis in an all-stock transaction valuing the genomics company at about $1.5bn. The two businesses have worked together on tumour profiling since 2023; the deal brings Personalis's whole-exome and minimal residual disease (MRD) testing in-house.

The transaction is expected to close in the first half of 2027, subject to shareholder and regulatory approval.

## The UK angle

Personalis already processes samples for a number of NHS Genomic Laboratory Hubs through a reseller arrangement. Combined, the businesses will be able to bid directly for pathology and molecular diagnostics work, where Foundation Medicine has been the main specialist supplier.`,
    why: "NHS Genomic Medicine Service procurement is consolidating around fewer, larger suppliers. A combined Tempus–Personalis can offer MRD monitoring alongside tumour profiling, which changes the shape of the next round of pathology tenders.",
    outlet: "Company announcement",
    url: "https://www.tempus.com/news/",
    cat: "investment-markets",
    legacy: "finance-ma",
    image: "/images/stories/architecture.webp",
    alt: "Architectural model of two modern laboratory buildings in warm light",
    week: 0,
    day: 2,
    minutes: 42,
    author: "Oruaro Onibere",
    facts: [["Deal value", "$1.5bn"], ["Structure", "All-stock"], ["Expected close", "H1 2027"]],
    pick: true,
  },
  {
    slug: "abridge-raises-340m-series-d-ambient-ai",
    headline: "Abridge raises $340m Series D to scale ambient AI across US health systems",
    standfirst:
      "The clinical documentation company's latest round values it among the most heavily funded ambient-scribe businesses, as NHS trusts weigh their own procurement.",
    body: `## What happened

Abridge has raised $340m in a Series D round to expand its ambient clinical documentation product across US health systems. The company says its software is now live in more than 150 health systems.

## Analysis

Ambient scribes have moved quickly from pilots to enterprise contracts in the US. In the UK, NHS England's guidance on ambient voice technology has set out assurance requirements, and several trusts are running evaluations. The size of this round gives Abridge room to compete for UK frameworks if it chooses to, but it has so far prioritised US EHR integrations.`,
    why: "Funding at this scale sets pricing expectations for ambient AI. UK trusts evaluating suppliers should expect well-capitalised US entrants alongside domestic vendors.",
    outlet: "Company announcement",
    url: "https://www.abridge.com/press",
    cat: "healthcare-technology",
    legacy: "digital-health",
    premium: true,
    image: "/images/stories/microphone.webp",
    alt: "Vintage studio microphone beside an open notebook",
    week: 0,
    day: 1,
    minutes: 55,
    author: "Oruaro Onibere",
    facts: [["Round size", "$340m"], ["Round", "Series D"], ["Health systems live", "150+"]],
  },
  {
    slug: "nhs-fast-tracks-ai-deployment-waiting-lists",
    headline: "NHS fast-tracks AI deployment across services in bid to tackle waiting lists",
    standfirst:
      "A new national programme shortens assurance timelines for AI tools already proven in at least one trust, with diagnostics and triage first in line.",
    body: `## What happened

NHS England has announced a programme to speed up adoption of AI tools that have already been deployed successfully in at least one trust. Suppliers that meet the programme's evidence threshold will follow a shortened assurance route, and trusts adopting them will be able to draw on central funding for implementation.

## Where it applies first

The first wave covers imaging triage, dermatology referral support and outpatient letter automation.`,
    why: "For suppliers with an NHS reference site, the commercial route to a second and third trust gets shorter. For those without one, the gap widens.",
    outlet: "NHS England",
    url: "https://www.england.nhs.uk/",
    cat: "regulation-policy",
    legacy: "nhs-policy",
    image: "/images/stories/books-chip.webp",
    alt: "Stack of hardback books with a circuit board resting on top",
    week: 0,
    day: 0,
    minutes: 35,
    author: "Oruaro Onibere",
    facts: [["First wave", "Imaging, dermatology, outpatient letters"]],
  },
  {
    slug: "optum-closes-3-2bn-landmark-acquisition",
    headline: "Optum closes $3.2bn Landmark acquisition, extending home-based care reach",
    standfirst: "The deal adds home-based medical care for complex patients to Optum's provider business.",
    body: `## What happened

Optum has completed its $3.2bn acquisition of Landmark Health, which provides in-home medical care to patients with multiple chronic conditions.

## Context

Home-based care for complex patients is a growing theme on both sides of the Atlantic. In England, virtual wards and hospital-at-home services have expanded since 2022, largely delivered by NHS providers with private-sector technology partners.`,
    why: "US consolidation of home-based care shows where scale economics are heading. UK operators in virtual wards are much smaller and largely NHS-contracted.",
    outlet: "UnitedHealth Group",
    url: "https://www.unitedhealthgroup.com/newsroom.html",
    cat: "investment-markets",
    legacy: "finance-ma",
    week: -1,
    day: 4,
    minutes: 30,
    author: "Oruaro Onibere",
    facts: [["Deal value", "$3.2bn"], ["Status", "Closed"]],
  },
  {
    slug: "merck-oral-pcsk9-inhibitor-nice-approval",
    headline: "Merck secures first approval for an oral PCSK9 inhibitor, reshaping the cholesterol market",
    standfirst:
      "NICE recommends the once-daily pill for adults with high cholesterol who cannot reach targets on statins, opening a primary-care route that injectables never had.",
    body: `## What happened

NICE has recommended Merck's oral PCSK9 inhibitor for adults whose LDL cholesterol remains high despite maximum tolerated statin therapy.

## Why the format matters

Existing PCSK9 treatments are injectables, mostly started in secondary care. A daily pill can be prescribed in primary care, which changes both the potential patient population and the budget impact for integrated care boards.`,
    why: "Primary-care prescribing at scale moves spend from specialist budgets to ICB prescribing budgets, and puts pressure on injectable incumbents' pricing.",
    outlet: "NICE",
    url: "https://www.nice.org.uk/guidance",
    cat: "healthcare-technology",
    legacy: "pharma-biotech",
    image: "/images/stories/capsule.webp",
    alt: "A single white capsule on a ceramic plate beside an amber glass bottle",
    week: -1,
    day: 3,
    minutes: 38,
    author: "Oruaro Onibere",
    facts: [["Regulator", "NICE"], ["Decision", "Recommended"]],
  },
  {
    slug: "spire-healthcare-appoints-advisers-consolidation",
    headline: "Spire Healthcare appoints advisers as private hospital consolidation accelerates",
    standfirst: "The UK's largest listed private hospital group is understood to be reviewing options, including a combination with a peer.",
    body: `## What happened

Spire Healthcare has appointed financial advisers to review strategic options, according to people familiar with the matter. The company has not commented on specific transactions.

## Analysis

The UK private hospital market has seen private-pay volumes plateau after the post-pandemic surge, while NHS-funded work through the e-Referral Service remains significant. Scale offers purchasing and consultant-recruitment benefits; competition review would be the main hurdle for any combination with a large peer.`,
    why: "A combination among the top four private hospital groups would be the largest UK provider deal in a decade and would be examined closely by the CMA.",
    outlet: "Market reports",
    url: "https://www.spirehealthcare.com/investors/",
    cat: "healthcare-companies",
    legacy: "private-healthcare",
    premium: true,
    week: -1,
    day: 2,
    minutes: 60,
    author: "Oruaro Onibere",
    facts: [["Status", "Advisers appointed"]],
  },
  {
    slug: "medicare-advantage-rate-cuts-2027-bids",
    headline: "Medicare Advantage rate cuts reshape 2027 bids as plans retreat from rural markets",
    standfirst:
      "Lower benchmark payments have pushed several large insurers to exit counties, with knock-on effects for the US provider groups that UK investors back.",
    body: `## What happened

Following lower-than-expected 2027 Medicare Advantage rates, several national insurers have filed bids that withdraw plans from rural counties.

## Analysis

UK-listed and UK-backed businesses with US value-based care exposure have seen valuations fall as a result. The direction of US payment policy now matters to several UK healthcare investors.`,
    why: "US payer economics drive valuations for value-based care businesses that UK funds and listed companies are exposed to.",
    outlet: "CMS",
    url: "https://www.cms.gov/newsroom",
    cat: "healthcare-companies",
    legacy: "healthcare-business",
    premium: true,
    image: "/images/stories/scales.webp",
    alt: "Brass balance scales with a stack of coins on one pan",
    week: -1,
    day: 1,
    minutes: 50,
    author: "Oruaro Onibere",
    facts: [["Plan year", "2027"]],
  },
  {
    slug: "pay-review-recommendations-add-1-1bn-nhs-cost-base",
    headline: "Pay review recommendations add £1.1bn to NHS provider cost base",
    standfirst: "Trusts must absorb the part of the award not covered by central funding, adding pressure to deficit plans.",
    body: `## What happened

The government has accepted pay review body recommendations for NHS staff. Analysis of the award against announced funding suggests about £1.1bn of additional cost falls on providers this year.

## Where it lands

Trusts already running deficit plans will need to find savings elsewhere, most likely through vacancy controls and reduced agency spend.`,
    why: "Unfunded pay pressure squeezes trusts' discretionary budgets, including spend with private and technology suppliers.",
    outlet: "DHSC",
    url: "https://www.gov.uk/government/organisations/department-of-health-and-social-care",
    cat: "nhs-healthcare-finance",
    legacy: "workforce-careers",
    week: -1,
    day: 0,
    minutes: 33,
    author: "Oruaro Onibere",
    facts: [["Unfunded cost", "£1.1bn"]],
  },
  {
    slug: "kkr-completes-envision-restructuring-7bn",
    headline: "KKR completes Envision restructuring at $7.0bn, wiping out earlier equity",
    standfirst: "The physician staffing group's creditors take control after a restructuring that values the business well below its 2018 buyout.",
    body: `## What happened

Envision Healthcare's restructuring has completed, with creditors taking control and KKR's equity from the 2018 buyout written off.

## Analysis

The collapse of the physician staffing model in the US, after surprise-billing legislation, is a reminder of how regulatory change can remove the economics of a leveraged healthcare services business.`,
    why: "A cautionary case for UK private equity in outsourced clinical staffing, where NHS agency caps play a similar role to US billing rules.",
    outlet: "Court filings",
    url: "https://www.envisionhealth.com/",
    cat: "investment-markets",
    legacy: "vc-pe",
    premium: true,
    week: -2,
    day: 4,
    minutes: 45,
    author: "Oruaro Onibere",
    facts: [["Restructuring value", "$7.0bn"]],
  },
  {
    slug: "paige-raises-75m-series-c-digital-pathology-europe",
    headline: "Paige raises $75m Series C to widen digital pathology footprint in Europe",
    standfirst: "The round funds expansion into European laboratory networks, including NHS pathology partnerships.",
    body: `## What happened

Paige has raised $75m in a Series C round. The company says the funding will expand its European presence, where it already works with several laboratory networks.

## Context

NHS pathology networks are mid-way through digitisation, creating an installed base for AI tools.`,
    why: "Digitised NHS pathology networks are a near-term market for AI diagnostic tools; Paige is positioning for it.",
    outlet: "Company announcement",
    url: "https://paige.ai/news/",
    cat: "healthcare-technology",
    legacy: "diagnostics",
    week: -2,
    day: 3,
    minutes: 28,
    author: "Oruaro Onibere",
    facts: [["Round size", "$75m"], ["Round", "Series C"]],
  },
  {
    slug: "mhra-guidance-adaptive-ai-medical-devices",
    headline: "MHRA publishes updated guidance on adaptive AI medical devices",
    standfirst: "Manufacturers can pre-specify how a model will change after approval, avoiding a fresh assessment for each update.",
    body: `## What happened

The MHRA has published guidance on predetermined change control plans for AI as a medical device, allowing manufacturers to set out in advance the updates they intend to make.

## Why it matters

Until now, material changes to an AI model could trigger re-assessment. The new route reduces the cost of keeping models current.`,
    why: "Lower regulatory friction for model updates makes the UK a more practical first market for AI device makers.",
    outlet: "MHRA",
    url: "https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency",
    cat: "regulation-policy",
    legacy: "nhs-policy",
    week: -2,
    day: 2,
    minutes: 32,
    author: "Oruaro Onibere",
    facts: [["Regulator", "MHRA"]],
  },
  {
    slug: "lilly-agrees-2-8bn-ataibeckley-acquisition",
    headline: "Lilly agrees $2.8bn AtaiBeckley acquisition in neuropsychiatry push",
    standfirst: "The deal brings a late-stage psychedelic-derived treatment for depression into Lilly's pipeline.",
    body: `## What happened

Eli Lilly has agreed to acquire AtaiBeckley for about $2.8bn.

## UK angle

Beckley Psytech was founded in Oxford, and UK clinical sites have featured in its trials.`,
    why: "A large-pharma exit validates UK-originated neuropsychiatry science and may lift valuations for comparable UK biotechs.",
    outlet: "Company announcement",
    url: "https://investor.lilly.com/news-releases",
    cat: "healthcare-technology",
    legacy: "pharma-biotech",
    week: -2,
    day: 1,
    minutes: 30,
    author: "Oruaro Onibere",
    facts: [["Deal value", "$2.8bn"]],
  },
  {
    slug: "bgo-acquires-whitechapel-life-sciences-campus-750m",
    headline: "BGO acquires Whitechapel life sciences campus for £750m",
    standfirst: "The property investor takes the London lab campus as demand for wet-lab space in the capital holds up.",
    body: `## What happened

BGO has acquired the Whitechapel life sciences campus in east London for £750m.

## Context

London's lab-space market has been tighter than Oxford and Cambridge, where new supply has outpaced demand.`,
    why: "Institutional appetite for London lab space supports the capital's bid to grow its life sciences cluster.",
    outlet: "Company announcement",
    url: "https://www.bgo.com/news",
    cat: "healthcare-companies",
    legacy: "healthcare-business",
    week: -2,
    day: 0,
    minutes: 27,
    author: "Oruaro Onibere",
    facts: [["Price", "£750m"]],
  },
];

export function seed(db: DatabaseSync) {
  const q = (sql: string) => db.prepare(sql);

  // Settings
  const setSetting = q("INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)");
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) setSetting.run(k, String(v));

  // Categories
  const insCat = q("INSERT INTO categories (slug, name, description, sort_order, is_active) VALUES (?, ?, ?, ?, ?)");
  ACTIVE_CATEGORIES.forEach(([slug, name, desc], i) => insCat.run(slug, name, desc, i + 1, 1));
  LEGACY_CATEGORIES.forEach(([slug, name], i) => insCat.run(slug, name, null, 100 + i, 0));
  const catId = (slug: string) => (q("SELECT id FROM categories WHERE slug = ?").get(slug) as { id: number }).id;
  for (const [slug, , target] of LEGACY_CATEGORIES) {
    q("UPDATE categories SET redirect_to_id = ? WHERE slug = ?").run(catId(target), slug);
  }

  // Plans: Free and Premium are public; the rest stay hidden and unbuyable.
  const insPlan = q(
    "INSERT INTO plans (code, name, price_month_pence, price_year_pence, features, watchlist_limit, is_public, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  insPlan.run(
    "free",
    "Free",
    0,
    0,
    JSON.stringify([
      "Every story not marked Premium",
      "The weekly briefing every Friday",
      "3 Premium articles a month",
      "Follow up to 3 companies",
      "The Daily Story and The MedTwenty Weekly newsletters",
    ]),
    3,
    1,
    1,
  );
  insPlan.run(
    "premium",
    "Premium",
    2900,
    29000,
    JSON.stringify([
      "Everything in Free",
      "Unlimited Premium articles, including editorial analysis",
      "The monthly original analysis",
      "Full archive",
      "Follow up to 25 companies",
      "Full Deal Flow Tracker and Regulatory Pipeline detail",
      "The Analyst Note, our monthly Premium newsletter",
    ]),
    25,
    1,
    2,
  );
  insPlan.run("professional", "Professional", 9900, 99000, "[]", 100, 0, 3);
  insPlan.run("corporate", "Corporate & Team", null, null, "[]", 250, 0, 4);
  insPlan.run("enterprise", "Enterprise", null, null, "[]", 1000, 0, 5);

  // Newsletters
  const insNl = q(
    "INSERT INTO newsletters (slug, name, description, cadence, is_premium, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  insNl.run("daily-story", "The Daily Story", "The day's verified story: what happened, why it matters, and the source.", "Weekdays, when the day's story is published", 0, 1, 1);
  insNl.run("weekly", "The MedTwenty Weekly", "The five most significant developments of the week, with an editorial overview.", "Fridays", 0, 1, 2);
  insNl.run("analyst-note", "The Analyst Note", "Our monthly original analysis, built from publicly available data.", "Monthly", 1, 1, 3);
  insNl.run("medtwenty-brief", "The MedTwenty Brief", null, "Daily", 0, 0, 10);
  insNl.run("morning-pulse", "The Morning Pulse", null, "Daily", 0, 0, 11);
  insNl.run("waiting-list", "The Waiting List", null, "Monthly", 0, 0, 12);
  insNl.run("regulatory-alerts", "Regulatory Alerts", null, "As they happen", 0, 0, 13);

  // Editions: this week and the two before it.
  const thisWeek = weekStart();
  const insEd = q("INSERT INTO editions (week_start, week_label, is_current) VALUES (?, ?, ?)");
  const editionIds: Record<number, number> = {};
  for (const w of [-2, -1, 0]) {
    const ws = addDays(thisWeek, w * 7);
    const r = insEd.run(ws, weekLabel(ws), w === 0 ? 1 : 0);
    editionIds[w] = Number(r.lastInsertRowid);
  }

  // Companies
  const companies: [string, string, string, string][] = [
    ["tempus", "Tempus", "Diagnostics", "US"],
    ["personalis", "Personalis", "Diagnostics", "US"],
    ["abridge", "Abridge", "Digital Health", "US"],
    ["optum", "Optum", "Providers", "US"],
    ["landmark-health", "Landmark Health", "Providers", "US"],
    ["spire-healthcare", "Spire Healthcare", "Providers", "GB"],
    ["merck", "Merck", "Pharma", "US"],
    ["kkr", "KKR", "Investor", "US"],
    ["envision-healthcare", "Envision Healthcare", "Providers", "US"],
    ["paige", "Paige", "Diagnostics", "US"],
    ["eli-lilly", "Eli Lilly", "Pharma", "US"],
    ["ataibeckley", "AtaiBeckley", "Biotech", "GB"],
    ["bgo", "BGO", "Real estate", "US"],
    ["hippocratic-ai", "Hippocratic AI", "Healthcare AI", "US"],
    ["eko-health", "Eko Health", "MedTech", "US"],
    ["viz-ai", "Viz.ai", "Healthcare AI", "US"],
  ];
  const insCo = q("INSERT INTO companies (slug, name, sector, country, source) VALUES (?, ?, ?, ?, 'seed')");
  for (const c of companies) insCo.run(...c);
  const coId = (slug: string) => (q("SELECT id FROM companies WHERE slug = ?").get(slug) as { id: number }).id;

  // Articles
  const now = Date.now();
  const insArt = q(`INSERT INTO articles
    (slug, headline, standfirst, body, why_it_matters, source_outlet, source_url, content_type, category_id, legacy_category_id,
     is_premium, is_editors_pick, status, published_at, edition_id, hero_image_url, hero_alt, editorial_minutes, author_name, read_minutes, views, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'story', ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, 'seed')`);
  const insFact = q(
    "INSERT INTO facts (article_id, kind, label, value, status, provenance, verified_at) VALUES (?, 'figure', ?, ?, 'verified', ?, ?)",
  );
  const artIds: Record<string, number> = {};
  for (const a of ARTICLES) {
    const day = addDays(thisWeek, a.week * 7 + a.day);
    let pub = new Date(`${day}T08:30:00Z`).getTime();
    if (pub > now) pub = now - 3600_000 * (3 - a.day);
    const pubIso = new Date(pub).toISOString();
    const r = insArt.run(
      a.slug, a.headline, a.standfirst, a.body, a.why, a.outlet, a.url,
      catId(a.cat), catId(a.legacy), a.premium ? 1 : 0, a.pick ? 1 : 0, pubIso, editionIds[a.week],
      a.image ?? null, a.alt ?? null, a.minutes, a.author,
      Math.max(2, Math.round(a.body.split(/\s+/).length / 200) + 2), 40 + Math.floor(Math.random() * 300),
    );
    const id = Number(r.lastInsertRowid);
    artIds[a.slug] = id;
    for (const [label, value] of a.facts) insFact.run(id, label, value, a.outlet, pubIso);
  }

  // Last week's Friday briefing
  const lastFri = addDays(thisWeek, -3);
  const lastWeekLabel = weekLabel(addDays(thisWeek, -7));
  const brief = insArt.run(
    `the-medtwenty-weekly-${lastWeekLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    `The MedTwenty Weekly: ${lastWeekLabel}`,
    "Consolidation in private hospitals, a new route for cholesterol treatment in primary care, and the cost of this year's NHS pay award.",
    `## Overview

This was a week about who pays. The pay award adds about £1.1bn to provider costs that trusts must find themselves, and that pressure will be felt by every supplier waiting on a discretionary budget. At the same time, NICE's recommendation of an oral PCSK9 inhibitor moves a class of cholesterol treatment from specialist clinics into primary care, which shifts spend onto integrated care board prescribing budgets.

In the private market, Spire Healthcare's appointment of advisers is the clearest sign yet that the UK's largest hospital groups see scale as the answer to flat private-pay volumes. Any combination among the top four would be examined closely by the CMA.

Across the Atlantic, Optum's completion of the Landmark deal and the retreat of Medicare Advantage plans from rural counties are reminders that US payment policy now drives valuations for several businesses with UK investors.

For healthcare businesses and investors, the thread is the same: margins are being decided by payers and regulators, not by demand.`,
    null,
    "MedTwenty",
    null,
    catId("investment-markets"),
    null,
    0,
    0,
    new Date(`${lastFri}T16:00:00Z`).toISOString(),
    editionIds[-1],
    null,
    null,
    70,
    "Oruaro Onibere",
    4,
    210,
  );
  const briefId = Number(brief.lastInsertRowid);
  q("UPDATE articles SET content_type = 'briefing', source_outlet = NULL WHERE id = ?").run(briefId);
  const briefRanks = [
    "pay-review-recommendations-add-1-1bn-nhs-cost-base",
    "merck-oral-pcsk9-inhibitor-nice-approval",
    "spire-healthcare-appoints-advisers-consolidation",
    "optum-closes-3-2bn-landmark-acquisition",
    "medicare-advantage-rate-cuts-2027-bids",
  ];
  const insBi = q("INSERT INTO briefing_items (briefing_id, article_id, rank) VALUES (?, ?, ?)");
  briefRanks.forEach((slug, i) => {
    insBi.run(briefId, artIds[slug], i + 1);
    q("UPDATE articles SET edition_rank = ? WHERE id = ?").run(i + 1, artIds[slug]);
  });

  // Monthly analysis (premium)
  const anaDay = addDays(thisWeek, -5);
  const ana = insArt.run(
    "uk-healthcare-dealmaking-q3-2026-what-the-numbers-say",
    "UK healthcare dealmaking in Q3 2026: what the numbers say",
    "Deal counts are down, but average values are up. Our analysis of every verified healthcare transaction we recorded this quarter shows where capital is concentrating.",
    `## Summary

We recorded every verified healthcare deal with a UK buyer, target or investor in the quarter, using company announcements, Companies House filings and regulatory notices.

## Findings

1. **Fewer, larger deals.** Deal count fell quarter on quarter while median disclosed value rose.
2. **Technology leads funding.** Diagnostics and ambient AI accounted for the largest share of venture funding by value.
3. **Providers consolidate.** Private hospital and community provider transactions were concentrated among the largest operators.

| Segment | Share of disclosed value |
| --- | --- |
| Healthcare technology | 46% |
| Providers | 31% |
| Life sciences real estate | 15% |
| Other | 8% |

## Method

Only transactions verified against a primary source are included. Values in other currencies are converted at the rate on the announcement date. Undisclosed values are counted in deal numbers but not in values.`,
    "Capital is concentrating in fewer, larger transactions. Businesses raising money should expect investors to favour scale and evidence of NHS adoption.",
    "MedTwenty analysis of public filings",
    null,
    catId("investment-markets"),
    null,
    1,
    1,
    new Date(`${anaDay}T09:00:00Z`).toISOString(),
    editionIds[-1],
    "/images/stories/scales.webp",
    "Brass balance scales with a stack of coins on one pan",
    240,
    "Oruaro Onibere",
    9,
    480,
  );
  q("UPDATE articles SET content_type = 'analysis' WHERE id = ?").run(Number(ana.lastInsertRowid));

  // Deals
  const insDeal = q(`INSERT INTO deals (deal_type, acquirer, target, company_id, sector, value_text, value_usd_m, round, status, announced_on, verified, article_id, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'seed')`);
  const d = (w: number, day: number) => addDays(thisWeek, w * 7 + day);
  insDeal.run("acquisition", "Tempus", "Personalis", coId("personalis"), "Diagnostics", "$1.5bn", 1500, null, "announced", d(0, 2), artIds["tempus-acquires-personalis-1-5bn-cancer-genomics"]);
  insDeal.run("funding", null, "Abridge", coId("abridge"), "Digital Health", "$340m", 340, "Series D", "closed", d(0, 1), artIds["abridge-raises-340m-series-d-ambient-ai"]);
  insDeal.run("acquisition", "Optum", "Landmark", coId("landmark-health"), "Providers", "$3.2bn", 3200, null, "closed", d(-1, 4), artIds["optum-closes-3-2bn-landmark-acquisition"]);
  insDeal.run("acquisition", "Spire Healthcare", "[redacted]", coId("spire-healthcare"), "Providers", "Undisclosed", null, null, "rumoured", d(-1, 2), artIds["spire-healthcare-appoints-advisers-consolidation"]);
  insDeal.run("funding", null, "Paige", coId("paige"), "Diagnostics", "$75m", 75, "Series C", "closed", d(-2, 3), artIds["paige-raises-75m-series-c-digital-pathology-europe"]);
  insDeal.run("restructuring", "KKR", "Envision", coId("envision-healthcare"), "Providers", "$7.0bn", 7000, null, "closed", d(-2, 4), artIds["kkr-completes-envision-restructuring-7bn"]);
  insDeal.run("acquisition", "Eli Lilly", "AtaiBeckley", coId("ataibeckley"), "Pharma & Biotech", "$2.8bn", 2800, null, "announced", d(-2, 1), artIds["lilly-agrees-2-8bn-ataibeckley-acquisition"]);
  insDeal.run("acquisition", "BGO", "Whitechapel campus", coId("bgo"), "Real estate", "£750m", 950, null, "closed", d(-2, 0), artIds["bgo-acquires-whitechapel-life-sciences-campus-750m"]);
  insDeal.run("funding", null, "Hippocratic AI", coId("hippocratic-ai"), "Healthcare AI", "$175m", 175, "Series B", "closed", d(-2, 2), null);
  insDeal.run("funding", null, "Eko Health", coId("eko-health"), "MedTech", "$125m", 125, "Series C", "closed", d(-2, 3), null);
  insDeal.run("funding", null, "Viz.ai", coId("viz-ai"), "Healthcare AI", "$100m", 100, "Series D", "closed", d(-1, 3), null);

  // Regulatory decisions
  const insReg = q(`INSERT INTO regulatory_decisions (product, company, company_id, regulator, decision, decided_on, summary, verified, article_id, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 'seed')`);
  insReg.run("Oral PCSK9 inhibitor", "Merck", coId("merck"), "NICE", "approved", d(-1, 3), "Recommended for adults not at LDL target on statins.", artIds["merck-oral-pcsk9-inhibitor-nice-approval"]);
  insReg.run("Adaptive AI medical devices", null, null, "MHRA", "guidance", d(-2, 2), "Guidance on predetermined change control plans.", artIds["mhra-guidance-adaptive-ai-medical-devices"]);
  insReg.run("AI deployment fast track", null, null, "NHS England", "guidance", d(0, 0), "Shortened assurance for AI proven in at least one trust.", artIds["nhs-fast-tracks-ai-deployment-waiting-lists"]);
  insReg.run("Casgevy (ages 2+)", "Vertex", null, "FDA", "approved", d(-1, 1), "Label extended to children aged two and over.", null);
  insReg.run("Digital therapeutics reimbursement", null, null, "Japan MHLW", "approved", d(-2, 4), "New reimbursement pathway for digital therapeutics.", null);

  // Article <-> entity links
  const link = q("INSERT OR IGNORE INTO article_entities (article_id, entity_type, entity_id) VALUES (?, 'company', ?)");
  const links: [string, string[]][] = [
    ["tempus-acquires-personalis-1-5bn-cancer-genomics", ["tempus", "personalis"]],
    ["abridge-raises-340m-series-d-ambient-ai", ["abridge"]],
    ["optum-closes-3-2bn-landmark-acquisition", ["optum", "landmark-health"]],
    ["spire-healthcare-appoints-advisers-consolidation", ["spire-healthcare"]],
    ["merck-oral-pcsk9-inhibitor-nice-approval", ["merck"]],
    ["kkr-completes-envision-restructuring-7bn", ["kkr", "envision-healthcare"]],
    ["paige-raises-75m-series-c-digital-pathology-europe", ["paige"]],
    ["lilly-agrees-2-8bn-ataibeckley-acquisition", ["eli-lilly", "ataibeckley"]],
    ["bgo-acquires-whitechapel-life-sciences-campus-750m", ["bgo"]],
  ];
  for (const [slug, cos] of links) for (const c of cos) link.run(artIds[slug], coId(c));

  // A few shortlist candidates so the Control Room isn't empty.
  const insCand = q(`INSERT INTO extracted_items (origin, source_url, source_outlet, published_at, suggested_category, raw_title, ai_summary, significance_score, ticks)
    VALUES ('manual', ?, ?, ?, ?, ?, ?, ?, '{}')`);
  insCand.run("https://www.cqc.org.uk/news", "CQC", new Date().toISOString(), "regulation-policy", "CQC publishes State of Care report", "Annual assessment of health and adult social care in England.", 72);
  insCand.run("https://www.england.nhs.uk/statistics/", "NHS England", new Date().toISOString(), "nhs-healthcare-finance", "Monthly RTT waiting list statistics", "Latest referral-to-treatment figures for England.", 68);
  insCand.run("https://find-and-update.company-information.service.gov.uk/", "Companies House", new Date().toISOString(), "healthcare-companies", "Private hospital group files annual accounts", "Accounts show revenue growth from NHS-funded activity.", 55);

  // Sources (A.2)
  const insSrc = q(
    "INSERT INTO sources (name, feed_url, source_type, category_slug, cadence, is_active, needs_verification) VALUES (?, ?, ?, ?, ?, 1, ?)",
  );
  insSrc.run("NHS England news", "https://www.england.nhs.uk/feed/", "rss", "nhs-healthcare-finance", "daily", 0);
  insSrc.run("DHSC announcements", "https://www.gov.uk/government/organisations/department-of-health-and-social-care.atom", "rss", "regulation-policy", "multiple_daily", 0);
  insSrc.run("MHRA announcements", "https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency.atom", "rss", "regulation-policy", "daily", 0);
  insSrc.run("NICE news", "https://www.nice.org.uk/news", "monitor", "regulation-policy", "daily", 1);
  insSrc.run("UKHSA announcements", "https://www.gov.uk/government/organisations/uk-health-security-agency.atom", "rss", "regulation-policy", "daily", 0);
  insSrc.run("CQC news", "https://www.cqc.org.uk/news", "monitor", "regulation-policy", "daily", 1);
  insSrc.run("Companies House filings (healthcare SIC codes)", "https://api.company-information.service.gov.uk/", "monitor", "healthcare-companies", "daily", 1);
  insSrc.run("HSJ (headlines)", "https://www.hsj.co.uk/", "monitor", "nhs-healthcare-finance", "daily", 1);
  insSrc.run("LaingBuisson news", "https://www.laingbuisson.com/news/", "monitor", "healthcare-companies", "weekly", 1);
  insSrc.run("Digital Health (UK)", "https://www.digitalhealth.net/feed/", "rss", "healthcare-technology", "daily", 1);

  // Indices: kept for later, hidden at launch.
  const insIdx = q("INSERT INTO indices (name, value, change_pct, is_public) VALUES (?, ?, ?, 0)");
  insIdx.run("MedTwenty Healthcare Index", 1011.9, 0.42);
  insIdx.run("MedTwenty Healthcare AI Index", 2135.3, -0.21);
  insIdx.run("MedTwenty Digital Health Index", 961.4, 0.18);

  // Legal pages: drafts until marked reviewed in the Control Room.
  const insLegal = q("INSERT INTO legal_pages (slug, title, body) VALUES (?, ?, ?)");
  for (const [slug, l] of Object.entries(LEGAL_DEFAULTS)) insLegal.run(slug, l.title, l.body);

  // Redirects from the old VanadiumNews site.
  const insRed = q("INSERT INTO redirects (from_path, to_path, note) VALUES (?, ?, ?)");
  insRed.run("/indices", "/news", "Indices hidden at launch");
  insRed.run("/indices/healthcare", "/news", "Indices hidden at launch");
  insRed.run("/vanadium-intelligence", "/membership", "VanadiumNews rebrand");
  insRed.run("/todays-twenty", "/", "Daily edition retired");

  // Complimentary Premium for orudigital@gmail.com
  q("INSERT INTO comp_grants (email, plan_code, until) VALUES ('orudigital@gmail.com', 'premium', NULL)").run();
}
