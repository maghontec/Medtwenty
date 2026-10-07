import { redirect } from "next/navigation";
import { get } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { planByCode } from "@/lib/content";
import { priceLabel, stripeMode } from "@/lib/billing";
import { demoPayAction } from "@/app/actions/member";

export const metadata = { title: "Test checkout", robots: { index: false } };

// Stand-in for Stripe Checkout while no Stripe keys are configured.
export default async function DemoCheckout({ searchParams }: { searchParams: Promise<{ session?: string; error?: string }> }) {
  const sp = await searchParams;
  if (stripeMode() !== "demo") redirect("/membership");
  const user = await currentUser();
  if (!user) redirect("/login");
  const row = get<{ plan_code: string; interval: "month" | "year"; used_at: string | null; user_id: number }>("SELECT * FROM demo_checkouts WHERE token = ?", sp.session || "");
  if (!row || row.used_at || row.user_id !== user.id) redirect("/membership");
  const plan = planByCode(row.plan_code)!;
  return (
    <div className="wrap max-w-md py-14">
      <p className="eyebrow rounded bg-cream px-3 py-1.5 text-center">Test mode · no real payment is taken</p>
      <h1 className="mt-6 font-serif text-3xl font-bold">MedTwenty {plan.name}</h1>
      <p className="mt-2 text-lg">
        {priceLabel(plan, row.interval)} per {row.interval}, renews automatically
      </p>
      <p className="mt-1 text-sm text-muted">{user.email}</p>
      <form action={demoPayAction} className="mt-8 space-y-4">
        <input type="hidden" name="session" value={sp.session} />
        <div>
          <label className="label" htmlFor="card">Card number</label>
          <input id="card" name="card" inputMode="numeric" defaultValue="4242 4242 4242 4242" className="input font-mono" />
          <p className="mt-1 text-xs text-muted">4242 4242 4242 4242 succeeds. 4000 0000 0000 0341 succeeds now and fails the next renewal.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="exp">Expiry</label>
            <input id="exp" defaultValue="12 / 34" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="cvc">CVC</label>
            <input id="cvc" defaultValue="123" className="input" />
          </div>
        </div>
        {sp.error && <p role="alert" className="text-sm text-down">{sp.error}</p>}
        <button className="btn btn-primary w-full">Subscribe</button>
      </form>
    </div>
  );
}
