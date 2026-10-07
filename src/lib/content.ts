import "server-only";
import { all, get, run, scalar } from "./db";
import { weekLabel, weekStart } from "./time";

export type Article = {
  id: number;
  slug: string;
  headline: string;
  standfirst: string | null;
  body: string;
  why_it_matters: string | null;
  source_outlet: string | null;
  source_url: string | null;
  content_type: "story" | "briefing" | "analysis";
  category_id: number | null;
  category_name: string | null;
  category_slug: string | null;
  topics: string | null;
  is_premium: number;
  is_editors_pick: number;
  status: string;
  review_note: string | null;
  scheduled_for: string | null;
  published_at: string | null;
  edition_id: number | null;
  edition_rank: number | null;
  hero_image_url: string | null;
  hero_alt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  editorial_minutes: number | null;
  author_name: string | null;
  read_minutes: number | null;
  send_daily: number;
  candidate_id: number | null;
  views: number;
  source: string;
  created_at: string;
  updated_at: string;
};

export type Category = { id: number; slug: string; name: string; description: string | null; sort_order: number; is_active: number; redirect_to_id: number | null };
export type Edition = { id: number; week_start: string; week_label: string; is_current: number };

const ART_SELECT = `SELECT a.*, c.name AS category_name, c.slug AS category_slug FROM articles a LEFT JOIN categories c ON c.id = a.category_id`;
const PUBLISHED = `a.status = 'published' AND a.published_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

export function activeCategories(): Category[] {
  return all<Category>("SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order");
}

export function categoryBySlug(slug: string): Category | undefined {
  return get<Category>("SELECT * FROM categories WHERE slug = ?", slug);
}

export function categoryById(id: number): Category | undefined {
  return get<Category>("SELECT * FROM categories WHERE id = ?", id);
}

/** This week's edition in UK time, created if needed, and the only one marked current. */
export function getOrCreateCurrentEdition(): Edition {
  const ws = weekStart();
  let ed = get<Edition>("SELECT * FROM editions WHERE week_start = ?", ws);
  if (!ed) {
    run("INSERT INTO editions (week_start, week_label, is_current) VALUES (?, ?, 0)", ws, weekLabel(ws));
    ed = get<Edition>("SELECT * FROM editions WHERE week_start = ?", ws)!;
  }
  if (!ed.is_current) {
    run("UPDATE editions SET is_current = CASE WHEN id = ? THEN 1 ELSE 0 END", ed.id);
    ed.is_current = 1;
  }
  return ed;
}

export function editionById(id: number) {
  return get<Edition>("SELECT * FROM editions WHERE id = ?", id);
}

export function previousEdition(ed: Edition): Edition | undefined {
  return get<Edition>("SELECT * FROM editions WHERE week_start < ? ORDER BY week_start DESC LIMIT 1", ed.week_start);
}

export function publishedInEdition(editionId: number, types: string[] = ["story", "analysis"]): Article[] {
  return all<Article>(
    `${ART_SELECT} WHERE ${PUBLISHED} AND a.edition_id = ? AND a.content_type IN (${types.map(() => "?").join(",")}) ORDER BY a.published_at DESC`,
    editionId,
    ...types,
  );
}

export function countInEdition(editionId: number): number {
  return scalar<number>(`SELECT COUNT(*) FROM articles a WHERE ${PUBLISHED} AND a.edition_id = ? AND a.content_type != 'briefing'`, editionId) ?? 0;
}

export function latestPublished(types: string[] = ["story", "analysis"]): Article | undefined {
  return get<Article>(
    `${ART_SELECT} WHERE ${PUBLISHED} AND a.content_type IN (${types.map(() => "?").join(",")}) ORDER BY a.published_at DESC LIMIT 1`,
    ...types,
  );
}

export function latestOfType(type: "briefing" | "analysis"): Article | undefined {
  return get<Article>(`${ART_SELECT} WHERE ${PUBLISHED} AND a.content_type = ? ORDER BY a.published_at DESC LIMIT 1`, type);
}

export function articleBySlug(slug: string): Article | undefined {
  return get<Article>(`${ART_SELECT} WHERE a.slug = ?`, slug);
}

export function articleById(id: number): Article | undefined {
  return get<Article>(`${ART_SELECT} WHERE a.id = ?`, id);
}

export function briefingItems(briefingId: number): Article[] {
  return all<Article>(
    `${ART_SELECT} JOIN briefing_items bi ON bi.article_id = a.id WHERE bi.briefing_id = ? ORDER BY bi.rank`,
    briefingId,
  );
}

export function listNews(opts: { categoryId?: number; type?: string; page?: number; perPage?: number; q?: string }) {
  const where = [PUBLISHED];
  const params: unknown[] = [];
  if (opts.categoryId) {
    where.push("a.category_id = ?");
    params.push(opts.categoryId);
  }
  if (opts.type) {
    where.push("a.content_type = ?");
    params.push(opts.type);
  }
  if (opts.q) {
    where.push("(a.headline LIKE ? OR a.standfirst LIKE ? OR a.body LIKE ?)");
    const like = `%${opts.q}%`;
    params.push(like, like, like);
  }
  const perPage = opts.perPage ?? 10;
  const page = Math.max(1, opts.page ?? 1);
  const total = scalar<number>(`SELECT COUNT(*) FROM articles a WHERE ${where.join(" AND ")}`, ...params) ?? 0;
  const items = all<Article>(
    `${ART_SELECT} WHERE ${where.join(" AND ")} ORDER BY a.published_at DESC LIMIT ? OFFSET ?`,
    ...params,
    perPage,
    (page - 1) * perPage,
  );
  return { items, total, page, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export function editorsPicks(): Article[] {
  return all<Article>(`${ART_SELECT} WHERE ${PUBLISHED} AND a.is_editors_pick = 1 ORDER BY a.published_at DESC LIMIT 5`);
}

export function publishedCount(): number {
  return scalar<number>(`SELECT COUNT(*) FROM articles a WHERE ${PUBLISHED}`) ?? 0;
}

export function mostReadThisMonth(): Article[] {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  return all<Article>(
    `${ART_SELECT} LEFT JOIN (SELECT article_id, COUNT(*) AS n FROM page_views WHERE created_at >= ? AND article_id IS NOT NULL GROUP BY article_id) pv ON pv.article_id = a.id
     WHERE ${PUBLISHED} AND a.published_at >= ? ORDER BY COALESCE(pv.n, 0) + a.views DESC LIMIT 5`,
    since,
    since,
  );
}

export type Deal = {
  id: number;
  deal_type: string;
  acquirer: string | null;
  target: string;
  company_id: number | null;
  sector: string | null;
  value_text: string | null;
  value_usd_m: number | null;
  round: string | null;
  investors: string | null;
  status: string;
  announced_on: string | null;
  verified: number;
  article_id: number | null;
  article_slug?: string | null;
  source: string;
};

export function latestDeals(limit = 5, verifiedOnly = true): Deal[] {
  return all<Deal>(
    `SELECT d.*, a.slug AS article_slug FROM deals d LEFT JOIN articles a ON a.id = d.article_id AND a.status = 'published'
     ${verifiedOnly ? "WHERE d.verified = 1" : ""} ORDER BY d.announced_on DESC, d.id DESC LIMIT ?`,
    limit,
  );
}

export type RegDecision = {
  id: number;
  product: string;
  company: string | null;
  regulator: string;
  decision: string;
  decided_on: string | null;
  summary: string | null;
  verified: number;
  article_id: number | null;
  article_slug?: string | null;
};

export function latestDecisions(limit = 5, verifiedOnly = true): RegDecision[] {
  return all<RegDecision>(
    `SELECT r.*, a.slug AS article_slug FROM regulatory_decisions r LEFT JOIN articles a ON a.id = r.article_id AND a.status = 'published'
     ${verifiedOnly ? "WHERE r.verified = 1" : ""} ORDER BY r.decided_on DESC, r.id DESC LIMIT ?`,
    limit,
  );
}

export function dealLabel(d: Deal): string {
  return d.acquirer ? `${d.acquirer} → ${d.target}` : d.target;
}

export type Company = { id: number; slug: string; name: string; sector: string | null; country: string | null; website: string | null; description: string | null; is_stub: number };

export function companyBySlug(slug: string) {
  return get<Company>("SELECT * FROM companies WHERE slug = ?", slug);
}

export function articlesForCompany(companyId: number): Article[] {
  return all<Article>(
    `${ART_SELECT} JOIN article_entities e ON e.article_id = a.id AND e.entity_type = 'company' WHERE e.entity_id = ? AND ${PUBLISHED} ORDER BY a.published_at DESC LIMIT 20`,
    companyId,
  );
}

export function companiesForArticle(articleId: number): Company[] {
  return all<Company>(
    "SELECT c.* FROM companies c JOIN article_entities e ON e.entity_id = c.id AND e.entity_type = 'company' WHERE e.article_id = ? ORDER BY c.name",
    articleId,
  );
}

export function publishedCorrections(articleId: number) {
  return all<{ id: number; note: string; kind: string; created_at: string }>(
    "SELECT id, note, kind, created_at FROM corrections WHERE article_id = ? AND status = 'published' ORDER BY created_at",
    articleId,
  );
}

export type Newsletter = { id: number; slug: string; name: string; description: string | null; cadence: string | null; is_premium: number; is_active: number };

export function activeNewsletters(): Newsletter[] {
  return all<Newsletter>("SELECT * FROM newsletters WHERE is_active = 1 ORDER BY sort_order");
}

export function newsletterBySlug(slug: string) {
  return get<Newsletter>("SELECT * FROM newsletters WHERE slug = ?", slug);
}

export type Plan = {
  code: string;
  name: string;
  price_month_pence: number | null;
  price_year_pence: number | null;
  features: string;
  watchlist_limit: number;
  is_public: number;
  stripe_price_month_test: string | null;
  stripe_price_year_test: string | null;
  stripe_price_month_live: string | null;
  stripe_price_year_live: string | null;
};

export function publicPlans(): Plan[] {
  return all<Plan>("SELECT * FROM plans WHERE is_public = 1 ORDER BY sort_order");
}

export function planByCode(code: string) {
  return get<Plan>("SELECT * FROM plans WHERE code = ?", code);
}

export function hasSeedData(): boolean {
  return !!get("SELECT 1 FROM articles WHERE source = 'seed' UNION SELECT 1 FROM deals WHERE source = 'seed' UNION SELECT 1 FROM companies WHERE source = 'seed' LIMIT 1");
}
