import { all } from "@/lib/db";
import { SITE, esc, xml } from "@/lib/sitemap";

// Indexable company pages only (not stubs).
export function GET() {
  const cos = all<{ slug: string }>("SELECT slug FROM companies WHERE is_stub = 0 ORDER BY name");
  return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${cos.map((c) => `<url><loc>${SITE}/companies/${esc(c.slug)}</loc></url>`).join("")}</urlset>`);
}
