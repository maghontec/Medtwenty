import "server-only";
import { cookies } from "next/headers";
import { get, run, scalar } from "./db";
import type { User } from "./auth";
import { monthKey } from "./time";

export const FREE_PREMIUM_READS = 3;
export const ANON_PREMIUM_READS = 1;
export const GRACE_DAYS = 7;

export type Subscription = {
  id: number;
  user_id: number;
  plan_code: string;
  interval: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: number;
  past_due_since: string | null;
  stripe_subscription_id: string | null;
  conversion_source: string | null;
  mode: string;
  amount_pence: number | null;
};

export type Entitlement = {
  plan: "free" | "premium" | string;
  premium: boolean;
  source: "free" | "subscription" | "comp";
  subscription: Subscription | null;
  renewal: string | null;
  pastDue: boolean;
  graceEndsAt: string | null;
  watchlistLimit: number;
};

export function latestSubscription(userId: number): Subscription | null {
  return (
    get<Subscription>(
      "SELECT * FROM subscriptions WHERE user_id = ? ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'trialing' THEN 0 WHEN 'past_due' THEN 1 ELSE 2 END, updated_at DESC LIMIT 1",
      userId,
    ) ?? null
  );
}

export function activeComp(email: string) {
  return get<{ plan_code: string; until: string | null }>(
    "SELECT plan_code, until FROM comp_grants WHERE email = ? AND revoked_at IS NULL AND (until IS NULL OR until > ?) ORDER BY id DESC LIMIT 1",
    email,
    new Date().toISOString(),
  );
}

function limitFor(plan: string): number {
  return scalar<number>("SELECT watchlist_limit FROM plans WHERE code = ?", plan) ?? 3;
}

export function entitlementFor(user: User | null): Entitlement {
  const free: Entitlement = {
    plan: "free",
    premium: false,
    source: "free",
    subscription: null,
    renewal: null,
    pastDue: false,
    graceEndsAt: null,
    watchlistLimit: limitFor("free"),
  };
  if (!user) return free;

  const sub = latestSubscription(user.id);
  if (sub) {
    const now = Date.now();
    const periodOk = !sub.current_period_end || new Date(sub.current_period_end).getTime() > now;
    if ((sub.status === "active" || sub.status === "trialing") && periodOk) {
      return { ...free, plan: sub.plan_code, premium: true, source: "subscription", subscription: sub, renewal: sub.current_period_end, watchlistLimit: limitFor(sub.plan_code) };
    }
    if (sub.status === "past_due" && sub.past_due_since) {
      const graceEnd = new Date(new Date(sub.past_due_since).getTime() + GRACE_DAYS * 86400_000);
      if (graceEnd.getTime() > now) {
        return {
          ...free,
          plan: sub.plan_code,
          premium: true,
          source: "subscription",
          subscription: sub,
          renewal: sub.current_period_end,
          pastDue: true,
          graceEndsAt: graceEnd.toISOString(),
          watchlistLimit: limitFor(sub.plan_code),
        };
      }
    }
  }

  const comp = activeComp(user.email);
  if (comp) {
    return { ...free, plan: comp.plan_code, premium: comp.plan_code !== "free", source: "comp", renewal: comp.until, watchlistLimit: limitFor(comp.plan_code) };
  }
  return { ...free, subscription: sub };
}

export function premiumReadsThisMonth(userId: number): number {
  return scalar<number>("SELECT COUNT(*) FROM premium_reads WHERE user_id = ? AND month = ?", userId, monthKey()) ?? 0;
}

/**
 * Decide whether the reader may see a premium article in full, recording the
 * read against the monthly meter when it uses one up.
 */
export async function checkPremiumAccess(
  user: User | null,
  ent: Entitlement,
  articleId: number,
): Promise<{ allowed: boolean; used: number; limit: number; anonymous: boolean }> {
  if (ent.premium) return { allowed: true, used: 0, limit: Infinity, anonymous: false };
  const month = monthKey();

  if (user) {
    const already = get("SELECT 1 FROM premium_reads WHERE user_id = ? AND article_id = ? AND month = ?", user.id, articleId, month);
    const used = premiumReadsThisMonth(user.id);
    if (already) return { allowed: true, used, limit: FREE_PREMIUM_READS, anonymous: false };
    if (used >= FREE_PREMIUM_READS) return { allowed: false, used, limit: FREE_PREMIUM_READS, anonymous: false };
    run("INSERT OR IGNORE INTO premium_reads (user_id, article_id, month) VALUES (?, ?, ?)", user.id, articleId, month);
    return { allowed: true, used: used + 1, limit: FREE_PREMIUM_READS, anonymous: false };
  }

  // Anonymous visitors: one premium piece a month, tracked in a necessary cookie.
  const jar = await cookies();
  const raw = jar.get("mt_meter")?.value || "";
  const [m, ids] = raw.split(":");
  const read = m === month && ids ? ids.split(",").filter(Boolean) : [];
  if (read.includes(String(articleId))) return { allowed: true, used: read.length, limit: ANON_PREMIUM_READS, anonymous: true };
  if (read.length >= ANON_PREMIUM_READS) return { allowed: false, used: read.length, limit: ANON_PREMIUM_READS, anonymous: true };
  return { allowed: true, used: read.length + 1, limit: ANON_PREMIUM_READS, anonymous: true };
}
