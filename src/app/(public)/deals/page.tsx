import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { all } from "@/lib/db";
import { dealLabel, type Deal } from "@/lib/content";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";
import { StatusPill } from "@/components/cards";
import { COMPLIANCE_NOTICE } from "@/components/SiteChrome";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = {
  title: "Deal Flow Tracker",
  description: "Verified healthcare M&A, funding rounds and restructurings covered by MedTwenty.",
  alternates: { canonical: "https://medtwenty.com/deals" },
};

const FREE_ROWS = 10;

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  if (!getSettings().show_deal_tracker) notFound();
  const sp = await searchParams;
  const ent = entitlementFor(await currentUser());
  const type = ["acquisition", "funding", "restructuring"].includes(sp.type || "") ? sp.type : undefined;
  const deals = all<Deal>(
    `SELECT d.*, a.slug AS article_slug FROM deals d LEFT JOIN articles a ON a.id = d.article_id AND a.status = 'published'
     WHERE d.verified = 1 ${type ? "AND d.deal_type = ?" : ""} ORDER BY d.announced_on DESC, d.id DESC`,
    ...(type ? [type] : []),
  );
  const shown = ent.premium ? deals : deals.slice(0, FREE_ROWS);
  return (
    <div className="wrap pt-10 md:pt-14">
      <h1 className="font-serif text-4xl font-bold md:text-5xl">Deal Flow Tracker</h1>
      <p className="mt-3 max-w-2xl text-lg text-[#3b3e45]">Every deal here has been verified against a primary source and linked to our coverage where we wrote about it.</p>
      <nav aria-label="Deal type" className="mt-6 flex gap-2 overflow-x-auto">
        {[["", "All"], ["acquisition", "Acquisitions"], ["funding", "Funding rounds"], ["restructuring", "Restructurings"]].map(([v, l]) => (
          <Link key={v} href={v ? `/deals?type=${v}` : "/deals"} className={`rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap ${(type || "") === v ? "border-charcoal bg-charcoal text-white" : "border-line"}`}>
            {l}
          </Link>
        ))}
      </nav>
      <div className="card mt-6 overflow-x-auto">
        <table className="table min-w-[640px]">
          <thead>
            <tr>
              <th scope="col">Deal</th>
              <th scope="col">Sector</th>
              <th scope="col">Value</th>
              <th scope="col">Status</th>
              <th scope="col">Date</th>
              {ent.premium && <th scope="col">Round / investors</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((d) => (
              <tr key={d.id}>
                <td className="font-medium">
                  {d.article_slug ? (
                    <Link href={`/news/${d.article_slug}`} className="hover:text-rust-text">
                      {dealLabel(d)}
                    </Link>
                  ) : (
                    dealLabel(d)
                  )}
                </td>
                <td className="text-muted">{d.sector}</td>
                <td className="font-serif text-lg font-semibold">{d.value_text || "Undisclosed"}</td>
                <td>
                  <StatusPill status={d.status} />
                </td>
                <td className="whitespace-nowrap text-muted">{formatDate(d.announced_on, { year: undefined })}</td>
                {ent.premium && <td className="text-muted">{[d.round, d.investors].filter(Boolean).join(" · ") || "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!ent.premium && (
        <div className="mt-6 rounded-lg bg-cream p-6">
          <p className="font-serif text-xl font-semibold">Full tracker detail is a Premium feature</p>
          <p className="mt-1 text-[#3b3e45]">Premium members see every verified deal with rounds and investors{deals.length > FREE_ROWS ? `, including ${deals.length - FREE_ROWS} more not shown here` : ""}.</p>
          <Link href="/membership?plan=premium&source=deal_tracker" className="btn btn-primary mt-4">
            See Premium
          </Link>
        </div>
      )}
      <p className="mt-6 text-xs text-muted">{COMPLIANCE_NOTICE}</p>
    </div>
  );
}
