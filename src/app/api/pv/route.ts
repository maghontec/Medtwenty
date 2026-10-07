import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentUser, rateLimit } from "@/lib/auth";
import { get, run } from "@/lib/db";

// First-party page views, recorded only after analytics consent.
export async function POST(req: Request) {
  const jar = await cookies();
  if (jar.get("mt_consent")?.value !== "all") return new NextResponse(null, { status: 204 });
  let body: { path?: string; anon?: string };
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const path = String(body.path || "").slice(0, 300);
  const anon = /^[0-9a-f-]{36}$/i.test(String(body.anon || "")) ? String(body.anon) : null;
  if (!path.startsWith("/") || !rateLimit(`pv:${anon || "x"}`, 120, 60)) return new NextResponse(null, { status: 204 });
  const user = await currentUser();
  const m = path.match(/^\/news\/([^/?#]+)$/);
  const articleId = m ? get<{ id: number }>("SELECT id FROM articles WHERE slug = ? AND status = 'published'", m[1])?.id ?? null : null;
  run("INSERT INTO page_views (path, anon_id, user_id, article_id) VALUES (?, ?, ?, ?)", path, anon, user?.id ?? null, articleId);
  if (articleId) run("UPDATE articles SET views = views + 1 WHERE id = ?", articleId);
  return new NextResponse(null, { status: 204 });
}
