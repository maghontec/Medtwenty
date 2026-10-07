import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { all, get } from "@/lib/db";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const data = {
    exported_at: new Date().toISOString(),
    account: get("SELECT id, email, name, email_confirmed_at, created_at, last_seen_at FROM users WHERE id = ?", user.id),
    subscriptions: all("SELECT plan_code, interval, status, current_period_end, cancel_at_period_end, conversion_source, consent_at, created_at FROM subscriptions WHERE user_id = ?", user.id),
    payments: all("SELECT amount_pence, currency, paid_at FROM payments WHERE user_id = ?", user.id),
    newsletters: all("SELECT n.name, s.status, s.consent_at, s.source FROM newsletter_subscribers s JOIN newsletters n ON n.id = s.newsletter_id WHERE s.email = ?", user.email),
    followed_companies: all("SELECT c.name, w.created_at FROM watchlist_items w JOIN companies c ON c.id = w.company_id WHERE w.user_id = ?", user.id),
    premium_reads: all("SELECT a.headline, r.month FROM premium_reads r JOIN articles a ON a.id = r.article_id WHERE r.user_id = ?", user.id),
  };
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="medtwenty-data.json"' },
  });
}
