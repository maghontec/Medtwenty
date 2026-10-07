import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { entitlementFor, latestSubscription } from "@/lib/entitlements";
import { stripeMode } from "@/lib/billing";
import { demoBillingAction, portalAction } from "@/app/actions/member";
import { formatDate } from "@/lib/time";
import { gbp } from "@/lib/format";
import { all } from "@/lib/db";
import Link from "next/link";

export const metadata = { title: "Plan and billing" };

export default async function BillingPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const ent = entitlementFor(user);
  const sub = latestSubscription(user.id);
  const demo = stripeMode() === "demo";
  const payments = all<{ amount_pence: number; paid_at: string }>("SELECT amount_pence, paid_at FROM payments WHERE user_id = ? ORDER BY paid_at DESC", user.id);
  return (
    <div className="wrap max-w-2xl space-y-6 py-10">
      <h1 className="font-serif text-3xl font-bold">Plan and billing</h1>
      <section className="card p-6">
        <p className="text-lg font-semibold">{ent.premium ? "Premium" : "Free"}{ent.source === "comp" ? " (complimentary)" : ""}</p>
        {sub && (
          <p className="mt-1 text-sm text-muted">
            Status: {sub.status.replace("_", " ")} · {sub.interval === "year" ? "Annual" : "Monthly"}
            {sub.current_period_end && ` · ${sub.cancel_at_period_end ? "ends" : "renews"} ${formatDate(sub.current_period_end)}`}
          </p>
        )}
        {!sub && !ent.premium && <Link href="/membership" className="btn btn-primary btn-sm mt-4">See Premium</Link>}
        {sub && !demo && <form action={portalAction}><button className="btn btn-primary btn-sm mt-4">Open Stripe billing portal</button></form>}
      </section>
      {sub && demo && (
        <section className="card p-6">
          <h2 className="eyebrow text-muted">Test-mode billing controls</h2>
          <p className="mt-2 text-sm text-muted">Stripe is not connected yet, so these buttons stand in for the Stripe billing portal.</p>
          <form action={demoBillingAction} className="mt-4 flex flex-wrap gap-2">
            {sub.cancel_at_period_end ? (
              <button name="op" value="resume" className="btn btn-outline btn-sm">Resume subscription</button>
            ) : (
              <button name="op" value="cancel" className="btn btn-outline btn-sm">Cancel at period end</button>
            )}
            <button name="op" value="switch" className="btn btn-outline btn-sm">Switch to {sub.interval === "month" ? "annual" : "monthly"}</button>
            {sub.status === "past_due" && <button name="op" value="card" className="btn btn-primary btn-sm">Update card (fixes payment)</button>}
            <button name="op" value="end_period" className="btn btn-outline btn-sm">Simulate end of period</button>
          </form>
        </section>
      )}
      {payments.length > 0 && (
        <section className="card p-6">
          <h2 className="eyebrow text-muted">Payments</h2>
          <ul className="mt-3 text-sm">
            {payments.map((p, i) => <li key={i} className="flex justify-between border-b border-line py-2">{formatDate(p.paid_at)}<span>{gbp(p.amount_pence)}</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
