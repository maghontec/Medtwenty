import { SITE, xml } from "@/lib/sitemap";

export function GET() {
  const now = new Date().toISOString();
  const maps = ["articles", "news", "companies"].map((m) => `<sitemap><loc>${SITE}/sitemaps/${m}.xml</loc><lastmod>${now}</lastmod></sitemap>`);
  return xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${maps.join("")}</sitemapindex>`);
}
