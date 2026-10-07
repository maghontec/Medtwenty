import { all } from "@/lib/db";
import { activeCategories } from "@/lib/content";
import { getSettings } from "@/lib/settings";
import { SITE, esc, xml } from "@/lib/sitemap";

export function GET() {
  const s = getSettings();
  const statics = ["/", "/news", "/news/briefings", "/news/analysis", "/membership", "/newsletters", "/about", "/editorial-standards", "/contact", "/privacy", "/terms", "/cookies", "/accessibility"];
  if (s.show_deal_tracker) statics.push("/deals");
  if (s.show_regulatory_pipeline) statics.push("/regulatory");
  const cats = activeCategories().map((c) => `/news/category/${c.slug}`);
  const arts = all<{ slug: string; updated_at: string }>("SELECT slug, updated_at FROM articles WHERE status = 'published' AND published_at <= ? ORDER BY published_at DESC", new Date().toISOString());
  const urls = [
    ...[...statics, ...cats].map((p) => `<url><loc>${SITE}${p}</loc></url>`),
    ...arts.map((a) => `<url><loc>${SITE}/news/${esc(a.slug)}</loc><lastmod>${a.updated_at}</lastmod></url>`),
  ];
  return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`);
}
