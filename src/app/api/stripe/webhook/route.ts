import { NextResponse } from "next/server";
import { handleStripeEvent, stripe, stripeMode } from "@/lib/billing";

// Stripe webhook: signature verified, idempotent via stripe_events.
export async function POST(req: Request) {
  if (stripeMode() === "demo") return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  const raw = await req.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    const r = await handleStripeEvent(event);
    return NextResponse.json({ received: true, ...r });
  } catch (e) {
    console.error("stripe webhook", event.type, e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}
