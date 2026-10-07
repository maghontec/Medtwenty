import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { all } from "@/lib/db";
import type { RegDecision } from "@/lib/content";
import { getSettings } from "@/lib/settings";
import { currentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";
import { StatusPill } from "@/components/cards";
import { COMPLIANCE_NOTICE } from "@/components/SiteChrome";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = {
  title: "Regulatory Pipeline",
  description: "Verified regulatory decisions and guidance from MHRA, NICE, NHS England and international regulators.",
  alternates: { canonical: "https://medtwenty.com/regulatory" },
};

const FREE_ROWS = 10;

export default async function RegulatoryPage() {
  if (!getSettings().show_regulatory_pipeline) notFound();
  const ent = entitlementFor(await currentUser());
  const rows = all<RegDecision>(
    `SELECT r.*, a.slug AS article_slug FROM regulatory_decisions r LEFT JOIN articles a ON a.id = r.article_id AND a.status = 'published'
     WHERE r.verified = 1 ORDER BY r.decided_on DESC, r.id DESC`,
  );
  const shown = ent.premium ? rows : rows.slice(0, FREE_ROWS);
  return (
    <div className="wrap pt-10 md:pt-14">
      <h1 className="font-serif text-4xl font-bold md:text-5xl">Regulatory Pipeline</h1>
      <p className="mt-3 max-w-2xl text-lg text-[#3b3e45]">Decisions and guidance that change the market, each verified against the regulator&apos;s own publication.</p>
      <div className="card mt-8 overflow-x-auto">
        <table className="table min-w-[640px]">
          <thead>
            <tr>
              <th scope="col">Product or subject</th>
              <th scope="col">Regulator</th>
              <th scope="col">Decision</th>
              <th scope="col">Date</th>
              {ent.premium && <th scope="col">Detail</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">
                  {r.article_slug ? (
                    <Link href={`/news/${r.article_slug}`} className="hover:text-rust-text">
                      {r.product}
                    </Link>
                  ) : (
                    r.product
                  )}
                  {r.company && <span className="ml-2 text-sm font-normal text-muted">{r.company}</span>}
                </td>
                <td className="text-muted">{r.regulator}</td>
                <td>
                  <StatusPill status={r.decision} />
                </td>
                <td className="whitespace-nowrap text-muted">{formatDate(r.decided_on, { year: undefined })}</td>
                {ent.premium && <td className="text-muted">{r.summary}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!ent.premium && (
        <div className="mt-6 rounded-lg bg-cream p-6">
          <p className="font-serif text-xl font-semibold">Full pipeline detail is a Premium feature</p>
          <p className="mt-1 text-[#3b3e45]">Premium members see the summary of every decision and the full history.</p>
          <Link href="/membership?plan=premium&source=regulatory_pipeline" className="btn btn-primary mt-4">
            See Premium
          </Link>
        </div>
      )}
      <p className="mt-6 text-xs text-muted">{COMPLIANCE_NOTICE}</p>
    </div>
  );
}
