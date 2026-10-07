import { all, scalar } from "@/lib/db";
import { getSettings, appUrl } from "@/lib/settings";
import { hasSeedData, planByCode } from "@/lib/content";
import { stripeMode } from "@/lib/billing";
import { requireStaff } from "@/lib/auth";
import { launchAction, launchCheckAction, removeSampleDataAction, syncPricesAction } from "@/app/actions/admin";
import { Flash, PageHead, Panel } from "../ui";

export const metadata = { title: "Launch checklist" };

export default async function Launch({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const isSuper = staff.roles.includes("super_admin");
  const s = getSettings();
  const manual = Object.fromEntries(all<{ key: string; done_at: string | null }>("SELECT key, done_at FROM launch_checks").map((r) => [r.key, !!r.done_at]));
  const realStories = scalar<number>("SELECT COUNT(*) FROM articles WHERE status = 'published' AND source != 'seed' AND content_type IN ('story','analysis')") ?? 0;
  const realBriefings = scalar<number>("SELECT COUNT(*) FROM articles WHERE status = 'published' AND source != 'seed' AND content_type = 'briefing'") ?? 0;
  const missingImages = scalar<number>("SELECT COUNT(*) FROM articles WHERE status = 'published' AND source != 'seed' AND content_type != 'briefing' AND (hero_image_url IS NULL OR hero_image_url = '')") ?? 0;
  const unreviewed = scalar<number>("SELECT COUNT(*) FROM legal_pages WHERE reviewed_at IS NULL") ?? 0;
  const premium = planByCode("premium");
  const live = appUrl().startsWith("https://medtwenty.com");

  const checks: { key: string; label: string; auto?: boolean; ok: boolean; hint?: string }[] = [
    { key: "seed", label: "Sample data removed", auto: true, ok: !hasSeedData() },
    { key: "content", label: "At least 5 real stories and 1 briefing published", auto: true, ok: realStories >= 5 && realBriefings >= 1, hint: `${realStories} stories, ${realBriefings} briefings` },
    { key: "images", label: "Real hero images on published pieces", auto: true, ok: realStories > 0 && missingImages === 0, hint: missingImages ? `${missingImages} without an image` : undefined },
    { key: "domains", label: "medtwenty.com primary; medtwenty.co.uk, med20.com and med20.co.uk redirect to it", ok: !!manual.domains },
    { key: "app_url", label: "APP_URL is the live domain (auth redirects and Stripe return URLs)", auto: true, ok: live, hint: appUrl() },
    { key: "resend", label: "Resend connected and mail.medtwenty.com domain verified", ok: !!process.env.RESEND_API_KEY && !!manual.resend, hint: process.env.RESEND_API_KEY ? "Key set; tick when the domain shows Verified in Resend" : "RESEND_API_KEY not set" },
    { key: "social", label: "Real social URLs set", auto: true, ok: !!(s.social_linkedin || s.social_x) },
    { key: "legal", label: "Legal pages marked reviewed", auto: true, ok: unreviewed === 0, hint: unreviewed ? `${unreviewed} still in draft` : undefined },
    { key: "vat", label: `VAT position confirmed with accountant (currently ${s.vat_registered ? "registered" : "not registered"})`, ok: !!manual.vat },
    { key: "gsc", label: "Google Search Console verified, sitemap submitted, change of address filed from the old domain", ok: !!manual.gsc },
    { key: "rebrand", label: "Rebrand notice on (reminder: switch off three months after launch)", auto: true, ok: s.rebrand_notice },
    { key: "stripe_live", label: "Stripe live keys set, live prices created and live webhook registered", ok: stripeMode() === "live" && !!premium?.stripe_price_month_live && !!manual.stripe_live, hint: `Mode: ${stripeMode()}${premium?.stripe_price_month_live ? ` · live prices ${premium.stripe_price_month_live}, ${premium.stripe_price_year_live}` : ""}` },
  ];
  const done = checks.filter((c) => c.ok).length;

  return (
    <>
      <PageHead title="Launch checklist" sub={`${done} of ${checks.length} complete · launch mode ${s.launch_mode ? "on" : `off since ${s.launch_date}`}`} />
      <Flash sp={sp} />
      <Panel>
        <ul className="divide-y divide-line">
          {checks.map((c) => (
            <li key={c.key} className="flex items-start justify-between gap-4 py-3">
              <div className="flex gap-3">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${c.ok ? "bg-up text-white" : "border border-[#bbb]"}`} aria-hidden="true">{c.ok ? "✓" : ""}</span>
                <div>
                  <p className={c.ok ? "" : "font-medium"}>{c.label}</p>
                  <p className="text-xs text-muted">{c.auto ? "Checked automatically" : "Tick by hand"}{c.hint ? ` · ${c.hint}` : ""}</p>
                </div>
              </div>
              {!c.auto && isSuper && (
                <form action={launchCheckAction}><input type="hidden" name="key" value={c.key} /><button className="btn btn-outline btn-sm">{manual[c.key] ? "Untick" : "Tick"}</button></form>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {isSuper && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <Panel title="Remove all sample data">
            <p className="text-sm text-muted">Deletes every row marked as sample (articles, deals, decisions, companies). The homepage hides empty modules, so it stays tidy.</p>
            <form action={removeSampleDataAction} className="mt-3 space-y-2">
              <input name="confirm" placeholder="Type REMOVE SAMPLE DATA" className="input text-sm" aria-label="Confirmation" />
              <button className="btn btn-danger btn-sm">Remove sample data</button>
            </form>
          </Panel>
          <Panel title="Stripe prices">
            <p className="text-sm text-muted">Creates Premium monthly and annual prices in Stripe ({stripeMode()} mode) from the plans table if they don&apos;t exist, and stores the price ids.</p>
            <ul className="mt-2 font-mono text-xs text-muted">
              <li>test: {premium?.stripe_price_month_test || "—"} / {premium?.stripe_price_year_test || "—"}</li>
              <li>live: {premium?.stripe_price_month_live || "—"} / {premium?.stripe_price_year_live || "—"}</li>
            </ul>
            <form action={syncPricesAction} className="mt-3"><button className="btn btn-outline btn-sm" disabled={stripeMode() === "demo"}>Create / check prices</button></form>
            <p className="mt-2 text-xs text-muted">Webhook endpoint: {appUrl()}/api/stripe/webhook (events: checkout.session.completed, customer.subscription.*, invoice.paid, invoice.payment_failed)</p>
          </Panel>
          <Panel title="Launch">
            <p className="text-sm text-muted">Sets launch mode off and the launch date to today. Do this after the checklist is complete and one real purchase has been tested and refunded.</p>
            <form action={launchAction} className="mt-3 space-y-2">
              <input name="confirm" placeholder="Type LAUNCH" className="input text-sm" aria-label="Confirmation" />
              <button className="btn btn-primary btn-sm" disabled={!s.launch_mode}>Launch</button>
            </form>
          </Panel>
        </div>
      )}
    </>
  );
}
