import { NextResponse } from "next/server";
import { tick } from "@/lib/editorial";

// Call every minute from a scheduler (e.g. cron-job.org or an n8n Cron node)
// with Authorization: Bearer $CRON_SECRET to publish scheduled pieces and send scheduled issues.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await tick(true);
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
