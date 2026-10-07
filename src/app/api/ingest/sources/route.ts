import { NextResponse } from "next/server";
import { authorize } from "@/lib/ingest";
import { all } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export async function GET(req: Request) {
  const denied = authorize(req);
  if (denied) return denied;
  const s = getSettings();
  const sources = s.ingest_paused
    ? []
    : all("SELECT id, name, feed_url, source_type, category_slug, cadence, last_success_at FROM sources WHERE is_active = 1 ORDER BY id");
  return NextResponse.json({ paused: s.ingest_paused, daily_cap: s.ingest_daily_cap, sources });
}
