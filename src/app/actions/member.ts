"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clientIp, currentUser, endSession, rateLimit, safeRedirect } from "@/lib/auth";
import { get, run, scalar } from "@/lib/db";
import { entitlementFor } from "@/lib/entitlements";
import { completeDemoCheckout, createCheckoutSession, createPortalSession, upsertSubscription, type Interval } from "@/lib/billing";
import { setMemberNewsletter, unsubscribeToken } from "@/lib/newsletters";
import { audit } from "@/lib/audit";

export async function checkoutAction(fd: FormData) {
  const plan = String(fd.get("plan") || "");
  const interval: Interval = fd.get("interval") === "year" ? "year" : "month";
  const source = String(fd.get("source") || "membership_page").replace(/[^a-z_]/g, "").slice(0, 40);
  const user = await currentUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/membership?plan=${plan}&interval=${interval}&source=${source}`)}`);
  if (!fd.get("consent")) redirect(`/membership?interval=${interval}&error=${encodeURIComponent("Please tick the box to confirm immediate access.")}`);
  if (!rateLimit(`checkout:${user.id}`, 10, 3600) || !rateLimit(`checkout-ip:${await clientIp()}`, 30, 3600)) {
    redirect(`/membership?error=${encodeURIComponent("Too many checkout attempts. Please try again later.")}`);
  }
  let url: string;
  try {
    url = await createCheckoutSession(user, plan, interval, source, new Date().toISOString());
  } catch (e) {
    redirect(`/membership?error=${encodeURIComponent((e as Error).message)}`);
  }
  redirect(url);
}

export async function demoPayAction(fd: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const session = String(fd.get("session") || "");
  try {
    await completeDemoCheckout(session, String(fd.get("card") || ""), user);
  } catch (e) {
    redirect(`/checkout/demo?session=${encodeURIComponent(session)}&error=${encodeURIComponent((e as Error).message)}`);
  }
  redirect("/premium-dashboard?welcome=1");
}

export async function portalAction() {
  const user = await currentUser();
  if (!user) redirect("/login");
  redirect(await createPortalSession(user));
}

/** Demo-mode billing actions (stand-ins for the Stripe portal when no keys are set). */
export async function demoBillingAction(fd: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const sub = get<{ id: number; stripe_subscription_id: string; plan_code: string; interval: Interval; current_period_end: string; status: string; cancel_at_period_end: number }>(
    "SELECT * FROM subscriptions WHERE user_id = ? AND stripe_subscription_id LIKE 'demo_%' ORDER BY id DESC LIMIT 1",
    user.id,
  );
  if (!sub) redirect("/account/billing");
  const op = String(fd.get("op"));
  const base = { userId: user.id, planCode: sub.plan_code, stripeSubscriptionId: sub.stripe_subscription_id };
  if (op === "cancel") upsertSubscription({ ...base, interval: sub.interval, status: sub.status, periodEnd: sub.current_period_end, cancelAtPeriodEnd: true });
  if (op === "resume") upsertSubscription({ ...base, interval: sub.interval, status: sub.status, periodEnd: sub.current_period_end, cancelAtPeriodEnd: false });
  if (op === "switch") upsertSubscription({ ...base, interval: sub.interval === "month" ? "year" : "month", status: sub.status, periodEnd: sub.current_period_end, cancelAtPeriodEnd: !!sub.cancel_at_period_end });
  if (op === "card") upsertSubscription({ ...base, interval: sub.interval, status: "active", periodEnd: sub.current_period_end, cancelAtPeriodEnd: !!sub.cancel_at_period_end });
  if (op === "end_period") {
    // Simulate time passing to the end of the period: cancelled subscriptions end.
    const status = sub.cancel_at_period_end ? "canceled" : sub.status;
    upsertSubscription({ ...base, interval: sub.interval, status, periodEnd: new Date(Date.now() - 1000).toISOString(), cancelAtPeriodEnd: !!sub.cancel_at_period_end });
  }
  audit({ id: user.id, email: user.email }, `billing_${op}`, "subscription", sub.id);
  redirect("/account/billing");
}

export async function followCompanyAction(fd: FormData) {
  const user = await currentUser();
  const back = safeRedirect(String(fd.get("back") || ""), "/dashboard");
  if (!user) redirect(`/login?redirect=${encodeURIComponent(back)}`);
  const companyId = Number(fd.get("company_id"));
  if (fd.get("follow") === "1") {
    const ent = entitlementFor(user);
    const n = scalar<number>("SELECT COUNT(*) FROM watchlist_items WHERE user_id = ?", user.id) ?? 0;
    // Limit enforced server-side from the plan.
    if (n >= ent.watchlistLimit) {
      redirect(`${back}${back.includes("?") ? "&" : "?"}limit=1`);
    }
    if (get("SELECT 1 FROM companies WHERE id = ?", companyId)) run("INSERT OR IGNORE INTO watchlist_items (user_id, company_id) VALUES (?, ?)", user.id, companyId);
  } else {
    run("DELETE FROM watchlist_items WHERE user_id = ? AND company_id = ?", user.id, companyId);
  }
  revalidatePath(back);
  redirect(back);
}

export async function newsletterToggleAction(fd: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const back = safeRedirect(String(fd.get("back") || ""), "/dashboard");
  try {
    setMemberNewsletter(user, String(fd.get("slug")), fd.get("on") === "1");
  } catch {
    /* premium-only newsletter for a free member: ignore */
  }
  redirect(back);
}

export async function unsubscribeAction(fd: FormData) {
  const t = String(fd.get("token") || "");
  unsubscribeToken(t);
  redirect(`/unsubscribe?token=${encodeURIComponent(t)}&done=1`);
}

export async function deleteAccountAction(fd: FormData) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (String(fd.get("confirm") || "").trim().toUpperCase() !== "DELETE") redirect("/account?error=Type+DELETE+to+confirm");
  const active = get("SELECT 1 FROM subscriptions WHERE user_id = ? AND status IN ('active','past_due') AND cancel_at_period_end = 0", user.id);
  if (active) redirect("/account?error=Cancel+your+Premium+subscription+in+Manage+billing+first");
  audit({ id: user.id, email: user.email }, "delete_account", "user", user.id);
  run("UPDATE newsletter_subscribers SET status = 'unsubscribed', user_id = NULL, unsubscribed_reason = 'account_deleted' WHERE email = ?", user.email);
  // Keep billing records (tax) but detach them from the person.
  run("UPDATE payments SET user_id = NULL WHERE user_id = ?", user.id);
  run("DELETE FROM users WHERE id = ?", user.id);
  await endSession("member");
  redirect("/?deleted=1");
}
