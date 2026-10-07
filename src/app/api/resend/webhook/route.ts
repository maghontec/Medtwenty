import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { get, run } from "@/lib/db";

// Resend webhooks are signed with Svix. Bounces and complaints unsubscribe the address.
function verify(raw: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigs = headers.get("svix-signature");
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${ts}.${raw}`).digest("base64");
  return sigs.split(" ").some((s) => {
    const v = s.split(",")[1];
    return !!v && v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected));
  });
}

const TYPES: Record<string, string> = {
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivered": "delivered",
};

export async function POST(req: Request) {
  const raw = await req.text();
  if (!verify(raw, req.headers)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  const evt = JSON.parse(raw) as { type: string; data: { email_id?: string; to?: string[] } };
  const type = TYPES[evt.type];
  if (!type) return NextResponse.json({ ignored: true });
  const ob = evt.data.email_id ? get<{ id: number; issue_id: number | null; to_email: string }>("SELECT id, issue_id, to_email FROM email_outbox WHERE provider_id = ?", evt.data.email_id) : undefined;
  run("INSERT INTO email_events (outbox_id, issue_id, type) VALUES (?, ?, ?)", ob?.id ?? null, ob?.issue_id ?? null, type);
  if (type === "bounced" || type === "complained") {
    const email = ob?.to_email || evt.data.to?.[0];
    if (email) run("UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_reason = ? WHERE email = ?", type, email);
  }
  return NextResponse.json({ ok: true });
}
