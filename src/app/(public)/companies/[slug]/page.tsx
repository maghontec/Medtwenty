import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { all } from "@/lib/db";
import { articlesForCompany, companyBySlug, dealLabel, type Deal } from "@/lib/content";
import { currentUser } from "@/lib/auth";
import { ArticleRow, StatusPill } from "@/components/cards";
import { followCompanyAction } from "@/app/actions/member";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = companyBySlug((await params).slug);
  if (!c) return {};
  return {
    title: c.name,
    description: `MedTwenty coverage of ${c.name}: verified stories and deals.`,
    alternates: { canonical: `https://medtwenty.com/companies/${c.slug}` },
    robots: c.is_stub ? { index: false } : undefined,
  };
}

export default async function CompanyPage({ params }: Props) {
  const c = companyBySlug((await params).slug);
  if (!c) notFound();
  const user = await currentUser();
  const following = user ? !!all("SELECT 1 FROM watchlist_items WHERE user_id = ? AND company_id = ?", user.id, c.id).length : false;
  const stories = articlesForCompany(c.id);
  const deals = all<Deal>("SELECT * FROM deals WHERE company_id = ? AND verified = 1 ORDER BY announced_on DESC", c.id);
  return (
    <div className="wrap max-w-[960px] pt-10 md:pt-14">
      <p className="eyebrow text-rust-text">Company</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-4xl font-bold md:text-5xl">{c.name}</h1>
        {user ? (
          <form action={followCompanyAction}>
            <input type="hidden" name="company_id" value={c.id} />
            <input type="hidden" name="follow" value={following ? "0" : "1"} />
            <input type="hidden" name="back" value={`/companies/${c.slug}`} />
            <button className={following ? "btn btn-outline" : "btn btn-primary"}>{following ? "Following" : "Follow"}</button>
          </form>
        ) : (
          <Link href={`/login?redirect=/companies/${c.slug}`} className="btn btn-outline">
            Sign in to follow
          </Link>
        )}
      </div>
      <p className="mt-2 text-muted">{[c.sector, c.country].filter(Boolean).join(" · ")}</p>
      {c.description && <p className="mt-4 text-lg">{c.description}</p>}

      {deals.length > 0 && (
        <section className="mt-10">
          <h2 className="border-b-2 border-ink pb-3 font-serif text-2xl font-bold">Deals</h2>
          <ul>
            {deals.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-4 border-b border-line py-4">
                <span className="font-medium">{dealLabel(d)}</span>
                <span className="flex items-center gap-3">
                  <span className="font-serif text-lg font-semibold">{d.value_text || "Undisclosed"}</span>
                  <StatusPill status={d.status} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-10">
        <h2 className="border-b-2 border-ink pb-3 font-serif text-2xl font-bold">Coverage</h2>
        {stories.length ? stories.map((a) => <ArticleRow key={a.id} a={a} />) : <p className="py-8 text-muted">No published stories yet.</p>}
      </section>
    </div>
  );
}
