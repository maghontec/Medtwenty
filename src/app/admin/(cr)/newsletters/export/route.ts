import { NextResponse, type NextRequest } from "next/server";
import { currentStaffSession } from "@/lib/auth";
import { all } from "@/lib/db";

export async function GET(req: NextRequest) {
  const s = await currentStaffSession();
  if (!s?.roles.some((r) => r === "super_admin" || r === "editor")) return new NextResponse("Access denied", { status: 403 });
  const nl = req.nextUrl.searchParams.get("nl");
  const rows = all<Record<string, string | null>>(
    `SELECT n.name AS newsletter, s.email, s.status, s.source, s.consent_at, s.created_at FROM newsletter_subscribers s JOIN newsletters n ON n.id = s.newsletter_id ${nl ? "WHERE s.newsletter_id = ?" : ""} ORDER BY s.created_at`,
    ...(nl ? [Number(nl)] : []),
  );
  const cols = ["newsletter", "email", "status", "source", "consent_at", "created_at"];
  const esc = (v: unknown) => {
    let t = String(v ?? "");
    if (/^[=+\-@]/.test(t)) t = "'" + t; // avoid spreadsheet formula injection
    return `"${t.replace(/"/g, '""')}"`;
  };
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": 'attachment; filename="subscribers.csv"' } });
}
