import "server-only";
import Stripe from "stripe";
import { get, run } from "./db";
import { appUrl, getSettings } from "./settings";
import { planByCode, type Plan } from "./content";
import { token, type User } from "./auth";
import { sendPaymentFailedEmail, sendWelcomeEmail } from "./email";
import { gbp } from "./format";
import { audit } from "./audit";

// Stripe billing. With STRIPE_SECRET_KEY set this uses real Stripe Checkout,
// webhooks and the billing portal. Without it, a built-in demo checkout runs
// the same subscription logic so the full flow can be tested before keys exist.

export type Interval = "month" | "year";

export function stripeMode(): "test" | "live" | "demo" {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return "demo";
  return key.startsWith("sk_live_") ? "live" : "test";
}

let _stripe: Stripe | null = null;
export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

export function priceLabel(plan: Plan, interval: Interval): string {
  const pence = interval === "year" ? plan.price_year_pence : plan.price_month_pence;
  const vat = getSettings().vat_registered ? " + VAT" : "";
  return `${gbp(pence)}${vat}`;
}

export function assertPurchasable(planCode: string): Plan {
  const plan = planByCode(planCode);
  if (!plan || !plan.is_public || plan.code === "free") throw new Error("This plan is not available to buy.");
  return plan;
}

async function ensurePrice(plan: Plan, interval: Interval): Promise<string> {
  const mode = stripeMode() === "live" ? "live" : "test";
  const col = `stripe_price_${interval === "year" ? "year" : "month"}_${mode}` as const;
  const existing = plan[col as keyof Plan] as string | null;
  if (existing) return existing;
  const s = stripe();
  const product = await s.products.create({ name: `MedTwenty ${plan.name}`, metadata: { plan_code: plan.code } });
  const amount = interval === "year" ? plan.price_year_pence : plan.price_month_pence;
  if (!amount) throw new Error("Plan has no price");
  const price = await s.prices.create({
    product: product.id,
    currency: "gbp",
    unit_amount: amount,
    recurring: { interval },
    tax_behavior: "exclusive",
    metadata: { plan_code: plan.code, interval },
  });
  run(`UPDATE plans SET ${col} = ? WHERE code = ?`, price.id, plan.code);
  return price.id;
}

/** Ensure Stripe prices exist for every purchasable plan. Returns the ids. */
export async function syncPrices() {
  const out: Record<string, string> = {};
  for (const code of ["premium"]) {
    const plan = assertPurchasable(code);
    out[`${code}_month`] = await ensurePrice(plan, "month");
    out[`${code}_year`] = await ensurePrice(planByCode(code)!, "year");
  }
  return out;
}

export async function createCheckoutSession(user: User, planCode: string, interval: Interval, conversionSource: string, consentAt: string): Promise<string> {
  const plan = assertPurchasable(planCode);
  if (stripeMode() === "demo") {
    const t = token(18);
    run(
      "INSERT INTO demo_checkouts (token, user_id, plan_code, interval, conversion_source, consent_at) VALUES (?, ?, ?, ?, ?, ?)",
      t,
      user.id,
      plan.code,
      interval,
      conversionSource,
      consentAt,
    );
    return `/checkout/demo?session=${t}`;
  }
  const s = stripe();
  const price = await ensurePrice(plan, interval);
  let customer = user.stripe_customer_id;
  if (!customer) {
    const c = await s.customers.create({ email: user.email, metadata: { user_id: String(user.id) } });
    customer = c.id;
    run("UPDATE users SET stripe_customer_id = ? WHERE id = ?", customer, user.id);
  }
  const vat = getSettings().vat_registered;
  const meta = { user_id: String(user.id), plan_code: plan.code, interval, conversion_source: conversionSource, consent_at: consentAt };
  const session = await s.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: 1 }],
    success_url: `${appUrl()}/premium-dashboard?welcome=1`,
    cancel_url: `${appUrl()}/membership`,
    automatic_tax: { enabled: vat },
    ...(vat ? { customer_update: { address: "auto" as const } } : {}),
    metadata: meta,
    subscription_data: { metadata: meta },
    allow_promotion_codes: true,
  });
  return session.url!;
}

export async function createPortalSession(user: User): Promise<string> {
  if (stripeMode() === "demo") return "/account/billing";
  if (!user.stripe_customer_id) return "/membership";
  const portal = await stripe().billingPortal.sessions.create({ customer: user.stripe_customer_id, return_url: `${appUrl()}/premium-dashboard` });
  return portal.url;
}

// ---------- Subscription state (shared by webhooks and demo mode) ----------

type SubUpdate = {
  userId: number;
  planCode: string;
  interval: Interval;
  status: string;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeSubscriptionId: string;
  conversionSource?: string | null;
  consentAt?: string | null;
  amountPence?: number | null;
};

export function upsertSubscription(u: SubUpdate): number {
  const existing = get<{ id: number; status: string; past_due_since: string | null }>(
    "SELECT id, status, past_due_since FROM subscriptions WHERE stripe_subscription_id = ?",
    u.stripeSubscriptionId,
  );
  const now = new Date().toISOString();
  const pastDueSince = u.status === "past_due" ? existing?.past_due_since || now : null;
  const mode = stripeMode() === "live" ? "live" : "test";
  if (existing) {
    run(
      `UPDATE subscriptions SET plan_code = ?, interval = ?, status = ?, current_period_end = ?, cancel_at_period_end = ?, past_due_since = ?,
       conversion_source = COALESCE(conversion_source, ?), consent_at = COALESCE(consent_at, ?), amount_pence = COALESCE(?, amount_pence), updated_at = ? WHERE id = ?`,
      u.planCode,
      u.interval,
      u.status,
      u.periodEnd,
      u.cancelAtPeriodEnd,
      pastDueSince,
      u.conversionSource ?? null,
      u.consentAt ?? null,
      u.amountPence ?? null,
      now,
      existing.id,
    );
    return existing.id;
  }
  return run(
    `INSERT INTO subscriptions (user_id, plan_code, interval, status, current_period_end, cancel_at_period_end, past_due_since, stripe_subscription_id, conversion_source, consent_at, mode, amount_pence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    u.userId,
    u.planCode,
    u.interval,
    u.status,
    u.periodEnd,
    u.cancelAtPeriodEnd,
    pastDueSince,
    u.stripeSubscriptionId,
    u.conversionSource ?? null,
    u.consentAt ?? null,
    mode,
    u.amountPence ?? null,
  ).lastId;
}

export function recordPayment(subId: number | null, userId: number | null, amountPence: number, invoiceId: string) {
  run(
    "INSERT OR IGNORE INTO payments (user_id, subscription_id, amount_pence, stripe_invoice_id, mode, paid_at) VALUES (?, ?, ?, ?, ?, ?)",
    userId,
    subId,
    amountPence,
    invoiceId,
    stripeMode() === "live" ? "live" : "test",
    new Date().toISOString(),
  );
}

export async function welcomePremium(user: User, planCode: string, interval: Interval) {
  const plan = planByCode(planCode)!;
  const pence = interval === "year" ? plan.price_year_pence : plan.price_month_pence;
  await sendWelcomeEmail(user.email, true, {
    price: gbp(pence),
    interval,
    vat: getSettings().vat_registered ? " plus VAT" : "",
  });
}

/** Demo checkout: complete a session as if Stripe had sent the webhooks. */
export async function completeDemoCheckout(sessionToken: string, card: string, user: User) {
  const row = get<{ token: string; user_id: number; plan_code: string; interval: Interval; conversion_source: string; consent_at: string; used_at: string | null }>(
    "SELECT * FROM demo_checkouts WHERE token = ?",
    sessionToken,
  );
  if (!row || row.user_id !== user.id || row.used_at) throw new Error("This checkout session is no longer valid.");
  const digits = card.replace(/\D/g, "");
  if (digits !== "4242424242424242" && digits !== "4000000000000341") throw new Error("Use test card 4242 4242 4242 4242 (or 4000 0000 0000 0341 to simulate a failed renewal).");
  const plan = assertPurchasable(row.plan_code);
  const periodEnd = new Date();
  if (row.interval === "year") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);
  const amount = row.interval === "year" ? plan.price_year_pence! : plan.price_month_pence!;
  const subId = upsertSubscription({
    userId: user.id,
    planCode: plan.code,
    interval: row.interval,
    status: "active",
    periodEnd: periodEnd.toISOString(),
    cancelAtPeriodEnd: false,
    stripeSubscriptionId: `demo_sub_${sessionToken}`,
    conversionSource: row.conversion_source,
    consentAt: row.consent_at,
    amountPence: amount,
  });
  recordPayment(subId, user.id, amount, `demo_in_${sessionToken}`);
  run("UPDATE demo_checkouts SET used_at = ? WHERE token = ?", new Date().toISOString(), sessionToken);
  audit({ id: user.id, email: user.email }, "subscribe", "subscription", subId, null, { plan: plan.code, interval: row.interval, mode: "demo" });
  await welcomePremium(user, plan.code, row.interval);
  // Card 0341 attaches but fails the next charge: simulate the renewal failing.
  if (digits === "4000000000000341") {
    upsertSubscription({ userId: user.id, planCode: plan.code, interval: row.interval, status: "past_due", periodEnd: periodEnd.toISOString(), cancelAtPeriodEnd: false, stripeSubscriptionId: `demo_sub_${sessionToken}` });
    await sendPaymentFailedEmail(user.email);
  }
}

// ---------- Stripe webhooks ----------

function periodEndOf(sub: Stripe.Subscription): string | null {
  const s = sub as unknown as { current_period_end?: number; items?: { data?: { current_period_end?: number }[] } };
  const ts = s.current_period_end ?? s.items?.data?.[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}

function userIdFor(customerId: string | null, meta?: Stripe.Metadata | null): number | null {
  if (meta?.user_id) return Number(meta.user_id);
  if (!customerId) return null;
  return get<{ id: number }>("SELECT id FROM users WHERE stripe_customer_id = ?", customerId)?.id ?? null;
}

async function applyStripeSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = userIdFor(customerId, sub.metadata);
  if (!userId) return;
  const item = sub.items.data[0];
  const priceId = item?.price.id;
  const planCode =
    sub.metadata?.plan_code ||
    get<{ code: string }>(
      "SELECT code FROM plans WHERE ? IN (stripe_price_month_test, stripe_price_year_test, stripe_price_month_live, stripe_price_year_live)",
      priceId,
    )?.code ||
    "premium";
  const status = sub.status === "canceled" || sub.status === "incomplete_expired" ? "canceled" : sub.status;
  upsertSubscription({
    userId,
    planCode,
    interval: (item?.price.recurring?.interval as Interval) || "month",
    status,
    periodEnd: periodEndOf(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    stripeSubscriptionId: sub.id,
    conversionSource: sub.metadata?.conversion_source || null,
    consentAt: sub.metadata?.consent_at || null,
    amountPence: item?.price.unit_amount ?? null,
  });
}

export async function handleStripeEvent(event: Stripe.Event) {
  if (get("SELECT 1 FROM stripe_events WHERE id = ?", event.id)) return { duplicate: true };
  const s = stripe();
  switch (event.type) {
    case "checkout.session.completed": {
      const cs = event.data.object as Stripe.Checkout.Session;
      if (cs.subscription) {
        const sub = await s.subscriptions.retrieve(typeof cs.subscription === "string" ? cs.subscription : cs.subscription.id);
        await applyStripeSubscription(sub);
        const userId = userIdFor(typeof cs.customer === "string" ? cs.customer : cs.customer?.id ?? null, cs.metadata);
        const user = userId ? get<User>("SELECT * FROM users WHERE id = ?", userId) : undefined;
        if (user) await welcomePremium(user, cs.metadata?.plan_code || "premium", (cs.metadata?.interval as Interval) || "month");
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await applyStripeSubscription(event.data.object as Stripe.Subscription);
      break;
    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } | null };
      const subRef = inv.subscription ?? (inv as unknown as { parent?: { subscription_details?: { subscription?: string } } }).parent?.subscription_details?.subscription;
      const subId = typeof subRef === "string" ? subRef : subRef?.id;
      if (subId) await applyStripeSubscription(await s.subscriptions.retrieve(subId));
      const local = subId ? get<{ id: number; user_id: number }>("SELECT id, user_id FROM subscriptions WHERE stripe_subscription_id = ?", subId) : undefined;
      recordPayment(local?.id ?? null, local?.user_id ?? null, inv.amount_paid, inv.id!);
      break;
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice & { subscription?: string | { id: string } | null };
      const subRef = inv.subscription ?? (inv as unknown as { parent?: { subscription_details?: { subscription?: string } } }).parent?.subscription_details?.subscription;
      const subId = typeof subRef === "string" ? subRef : subRef?.id;
      if (subId) {
        await applyStripeSubscription(await s.subscriptions.retrieve(subId));
        run(
          "UPDATE subscriptions SET status = 'past_due', past_due_since = COALESCE(past_due_since, ?) WHERE stripe_subscription_id = ?",
          new Date().toISOString(),
          subId,
        );
      }
      if (inv.customer_email) await sendPaymentFailedEmail(inv.customer_email);
      break;
    }
  }
  run("INSERT OR IGNORE INTO stripe_events (id, type) VALUES (?, ?)", event.id, event.type);
  return { duplicate: false };
}

/** Grant a complimentary plan (super_admin only; checked by the caller). */
export function grantCompPlan(email: string, planCode: string, until: string | null, actor: { id: number; email: string }) {
  const plan = planByCode(planCode);
  if (!plan) throw new Error("Unknown plan");
  run("UPDATE comp_grants SET revoked_at = ? WHERE email = ? AND revoked_at IS NULL", new Date().toISOString(), email);
  const id = run("INSERT INTO comp_grants (email, plan_code, until, created_by) VALUES (?, ?, ?, ?)", email.toLowerCase(), planCode, until, actor.id).lastId;
  audit(actor, "grant_comp_plan", "comp_grant", id, null, { email, planCode, until });
  return id;
}

export function revokeCompPlan(email: string, actor: { id: number; email: string }) {
  run("UPDATE comp_grants SET revoked_at = ? WHERE email = ? AND revoked_at IS NULL", new Date().toISOString(), email);
  audit(actor, "revoke_comp_plan", "comp_grant", email, null, null);
}
