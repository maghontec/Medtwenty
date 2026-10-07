import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { staffLogoutAction } from "@/app/actions/auth";
import { hasSeedData } from "@/lib/content";
import { stripeMode } from "@/lib/billing";
import { tick } from "@/lib/editorial";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = { title: { default: "Control Room", template: "%s | Control Room" }, robots: { index: false, follow: false } };

const NAV = [
  { group: "Today", items: [{ href: "/admin", label: "Overview" }] },
  {
    group: "Editorial",
    items: [
      { href: "/admin/shortlist", label: "Shortlist" },
      { href: "/admin/pipeline", label: "Story pipeline" },
      { href: "/admin/articles", label: "Article editor" },
      { href: "/admin/briefing", label: "Weekly briefing" },
      { href: "/admin/newsletters", label: "Newsletters" },
    ],
  },
  {
    group: "Data",
    items: [
      { href: "/admin/deals", label: "Deals" },
      { href: "/admin/regulatory", label: "Regulatory decisions" },
      { href: "/admin/companies", label: "Companies" },
      { href: "/admin/sources", label: "Sources" },
    ],
  },
  {
    group: "Business",
    items: [
      { href: "/admin/members", label: "Members" },
      { href: "/admin/metrics", label: "Metrics" },
    ],
  },
  {
    group: "System",
    items: [
      { href: "/admin/audit", label: "Audit log" },
      { href: "/admin/settings", label: "Site settings" },
      { href: "/admin/ingestion/docs", label: "Ingestion API" },
      { href: "/admin/launch", label: "Launch checklist" },
    ],
  },
];

export default async function ControlRoomLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  await tick();
  const seed = hasSeedData();
  return (
    <div className="min-h-screen bg-cream-2 md:grid md:grid-cols-[240px_1fr]">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="bg-charcoal text-white/80 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
        <div className="px-5 py-5">
          <Link href="/admin" className="font-serif text-xl font-bold text-white">
            Med<span className="text-rust-light">Twenty</span>
          </Link>
          <p className="eyebrow mt-1 text-[0.6rem] text-white/50">Control Room</p>
        </div>
        <AdminNav nav={NAV} />
        <div className="space-y-2 border-t border-white/10 px-5 py-4 text-xs">
          <p className="truncate text-white/60">{staff.email}</p>
          <p className="text-white/50">{staff.roles.join(", ").replace("_", " ")}</p>
          <div className="flex gap-3">
            <Link href="/" className="underline" target="_blank">View site</Link>
            <form action={staffLogoutAction}>
              <button className="underline">Sign out</button>
            </form>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        {(seed || stripeMode() !== "live") && (
          <div className="flex flex-wrap gap-2 border-b border-line bg-white px-6 py-2 text-xs">
            {seed && <span className="eyebrow rounded bg-[#fdf0d5] px-2 py-1 text-[#7a5200]">Sample data</span>}
            <span className="eyebrow rounded bg-cream px-2 py-1">Stripe: {stripeMode()}</span>
            {!process.env.RESEND_API_KEY && <span className="eyebrow rounded bg-cream px-2 py-1">Email: outbox only</span>}
          </div>
        )}
        <main id="main" className="px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
