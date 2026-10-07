import { NextResponse, type NextRequest } from "next/server";
import { get, run } from "@/lib/db";

export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("token") || "";
  const u = t ? get<{ id: number }>("SELECT id FROM users WHERE confirm_token = ?", t) : undefined;
  if (u) run("UPDATE users SET email_confirmed_at = ?, confirm_token = NULL WHERE id = ?", new Date().toISOString(), u.id);
  return NextResponse.redirect(new URL(u ? "/dashboard?confirmed=1" : "/login", req.url));
}
