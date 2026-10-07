import type { Metadata } from "next";
import Link from "next/link";
import { publicPlans } from "@/lib/content";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";
import { gbp } from "@/lib/format";
import { checkoutAction } from "@/app/actions/member";

export const metadata: Metadata = {
  title: "Membership",
  description: "MedTwenty Free and Premium: what each includes and what it costs.",
  alternates: { canonical: "https://medtwenty.com/membership" },
};

const FAQ: [string, string][] = [
  ["What do you publish?", "One verified story each weekday, a weekly briefing every Friday and one original analysis each month. Every piece is selected, checked against its primary source and published by our editor."],
  ["What is Premium content?", "Editorial-analysis stories (usually one or two a week) and the monthly analysis. Curated daily stories and the weekly briefing are free."],
  ["How does the free allowance work?", "Free members can read three Premium articles each calendar month. The count resets on the 1st."],
  ["Can I cancel?", "Yes, at any time from Manage billing on your dashboard. Premium stays active until the end of the period you have paid for and then does not renew."],
  ["Can I switch between monthly and annual?", "Yes, from Manage billing. The change applies from your next renewal."],
];

export default async function MembershipPage({ searchParams }: { searchParams: Promise<{ interval?: string; source?: string; plan?: string; error?: string }> }) {
  const sp = await searchParams;
  const s = getSettings();
  const user = await currentUser();
  const ent = entitlementFor(user);
  const plans = publicPlans();
  const interval = sp.interval === "year" ? "year" : "month";
  const source = (sp.source || "membership_page").replace(/[^a-z_]/g, "").slice(0, 40);
  const vat = s.vat_registered;

  return (
    <div className="wrap pt-10 md:pt-14">
      <div className="max-w-3xl">
        <p className="eyebrow text-rust-text">MedTwenty Intelligence</p>
        <h1 className="mt-2 font-serif text-4xl font-bold md:text-5xl">Membership</h1>
        <p className="mt-4 text-lg text-[#3b3e45]">
          MedTwenty is small on purpose: one verified story each weekday, a Friday briefing and a monthly analysis. Most of it is free. Premium pays for the analysis.
        </p>
      </div>

      {sp.error && (
        <p role="alert" className="mt-6 rounded-md bg-[#f6e2e0] px-4 py-3 text-down">
          {sp.error}
        </p>
      )}

      {s.show_paid_tiers && (
        <div className="mt-8 inline-flex rounded-full border border-line p-1" role="group" aria-label="Billing interval">
          <Link href={`/membership?interval=month&source=${source}`} aria-current={interval === "month" ? "true" : undefined} className={`rounded-full px-4 py-1.5 text-sm ${interval === "month" ? "bg-charcoal text-white" : ""}`}>
            Monthly
          </Link>
          <Link href={`/membership?interval=year&source=${source}`} aria-current={interval === "year" ? "true" : undefined} className={`rounded-full px-4 py-1.5 text-sm ${interval === "year" ? "bg-charcoal text-white" : ""}`}>
            Annual
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {plans
          .filter((p) => p.code === "free" || s.show_paid_tiers)
          .map((p) => {
            const features = JSON.parse(p.features) as string[];
            const pence = interval === "year" ? p.price_year_pence : p.price_month_pence;
            const isPremium = p.code !== "free";
            const current = (ent.plan === p.code && (isPremium ? ent.premium : !ent.premium)) || (!user && false);
            return (
              <section key={p.code} className={`flex flex-col rounded-lg border p-6 md:p-8 ${isPremium ? "border-2 border-charcoal" : "border-line"}`} aria-labelledby={`plan-${p.code}`}>
                <h2 id={`plan-${p.code}`} className="font-serif text-3xl font-bold">
                  {p.name}
                </h2>
                <p className="mt-3">
                  <span className="font-serif text-4xl font-bold">{isPremium ? gbp(pence) : "£0"}</span>
                  {isPremium && (
                    <span className="text-muted">
                      {" "}
                      / {interval}
                      {vat ? " + VAT" : ""}
                    </span>
                  )}
                </p>
                {isPremium && interval === "year" && p.price_month_pence && p.price_year_pence && (
                  <p className="mt-1 text-sm text-up">Two months free compared with monthly</p>
                )}
                <ul className="mt-6 space-y-3">
                  {features.map((f) => (
                    <li key={f} className="flex gap-3">
                      <span className="mt-1 text-rust" aria-hidden="true">
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-8">
                  {!isPremium ? (
                    user ? (
                      <p className="text-sm text-muted">{ent.premium ? "Included in your Premium plan." : "This is your current plan."}</p>
                    ) : (
                      <Link href="/signup" className="btn btn-outline w-full">
                        Create free account
                      </Link>
                    )
                  ) : current ? (
                    <Link href="/premium-dashboard" className="btn btn-dark w-full">
                      You&apos;re a Premium member
                    </Link>
                  ) : user ? (
                    <form action={checkoutAction} className="space-y-4">
                      <input type="hidden" name="plan" value={p.code} />
                      <input type="hidden" name="interval" value={interval} />
                      <input type="hidden" name="source" value={source} />
                      <div className="rounded-md bg-cream-2 p-4 text-sm text-[#33363d]">
                        <p>
                          <strong>
                            {gbp(pence)} per {interval}
                            {vat ? " plus VAT at 20%" : ""}
                          </strong>
                          {vat ? "." : ". No VAT is charged."} Renews automatically every {interval} until you cancel. Cancel any time from Manage billing; you keep access until the end of the paid period.
                        </p>
                      </div>
                      <label className="flex gap-3 text-sm">
                        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 shrink-0 accent-[#a64f1c]" />
                        <span>I want access to start immediately and understand that I lose my 14-day cancellation right once access begins.</span>
                      </label>
                      <button className="btn btn-primary w-full">Continue to payment</button>
                    </form>
                  ) : (
                    <Link href={`/login?redirect=${encodeURIComponent(`/membership?plan=premium&interval=${interval}&source=${source}`)}`} className="btn btn-primary w-full">
                      Sign in to subscribe
                    </Link>
                  )}
                </div>
              </section>
            );
          })}
      </div>

      <section className="mt-16 max-w-3xl" aria-labelledby="faq">
        <h2 id="faq" className="border-b-2 border-ink pb-3 font-serif text-3xl font-bold">
          Questions
        </h2>
        <dl>
          {FAQ.map(([q, a]) => (
            <div key={q} className="border-b border-line py-5">
              <dt className="font-serif text-lg font-semibold">{q}</dt>
              <dd className="mt-1 text-[#3b3e45]">{a}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
