import type { Metadata } from "next";
import Link from "next/link";
import { all } from "@/lib/db";
import { listNews, type Company } from "@/lib/content";
import { ArticleRow } from "@/components/cards";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q || "").trim().slice(0, 100);
  const results = q ? listNews({ q, perPage: 30 }) : null;
  const companies = q ? all<Company>("SELECT * FROM companies WHERE name LIKE ? ORDER BY is_stub, name LIMIT 8", `%${q}%`) : [];
  return (
    <div className="wrap max-w-[960px] pt-10 md:pt-14">
      <h1 className="font-serif text-4xl font-bold">Search</h1>
      <form action="/search" className="mt-6 flex gap-3" role="search">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <input id="q" name="q" defaultValue={q} className="input h-12" placeholder="Search stories, companies, deals" />
        <button className="btn btn-primary h-12">Search</button>
      </form>
      {companies.length > 0 && (
        <div className="mt-8">
          <h2 className="eyebrow text-muted">Companies</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {companies.map((c) => (
              <li key={c.id}>
                <Link href={`/companies/${c.slug}`} className="inline-block rounded-full border border-line px-3 py-1 text-sm hover:border-rust">
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {results && (
        <div className="mt-8">
          <p className="text-sm text-muted">
            {results.total} {results.total === 1 ? "result" : "results"} for &ldquo;{q}&rdquo;
          </p>
          {results.items.map((a) => (
            <ArticleRow key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
