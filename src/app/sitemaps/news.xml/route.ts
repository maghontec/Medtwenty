import { all } from "@/lib/db";
import { SITE, esc, xml } from "@/lib/sitemap";

// Google News sitemap: the last 48 hours.
export function GET() {
  const since = new Date(Date.now() - 48 * 3600_000).toISOString();
  const arts = all<{ slug: string; headline: string; published_at: string }>(
    "SELECT slug, headline, published_at FROM articles WHERE status = 'published' AND published_at >= ? AND published_at <= ? ORDER BY published_at DESC",
    since,
    new Date().toISOString(),
  );
  const urls = arts.map(
    (a) =>
      `<url><loc>${SITE}/news/${esc(a.slug)}</loc><news:news><news:publication><news:name>MedTwenty</news:name><news:language>en</news:language></news:publication><news:publication_date>${a.published_at}</news:publication_date><news:title>${esc(a.headline)}</news:title></news:news></url>`,
  );
  return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${urls.join("")}</urlset>`);
}
