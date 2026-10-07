import { NextResponse } from "next/server";
import { currentStaffSession } from "@/lib/auth";
import { get } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await currentStaffSession();
  if (!s?.roles.length) return new NextResponse("Access denied", { status: 403 });
  const row = get<{ html: string }>("SELECT html FROM email_outbox WHERE id = ?", Number((await params).id));
  if (!row) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(row.html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'" } });
}
