import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/premium-dashboard", "/account", "/search", "/api/ingest", "/checkout"] }],
    sitemap: "https://medtwenty.com/sitemap.xml",
  };
}
