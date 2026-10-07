import Link from "next/link";
import { activeCategories, editorsPicks, listNews } from "@/lib/content";
import { ArticleRow } from "./cards";

const TYPES = [
  { value: "", label: "All" },
  { value: "story", label: "Stories" },
  { value: "briefing", label: "Briefings" },
  { value: "analysis", label: "Analysis" },
];

export function NewsList({
  title,
  intro,
  basePath,
  categoryId,
  categorySlug,
  type,
  page,
  lockType = false,
}: {
  title: string;
  intro?: string;
  basePath: string;
  categoryId?: number;
  categorySlug?: string;
  type?: string;
  page: number;
  lockType?: boolean;
}) {
  const { items, pages } = listNews({ categoryId, type, page, perPage: 10 });
  const cats = activeCategories();
  const picks = editorsPicks();
  const qs = (p: Record<string, string | number | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) if (v) u.set(k, String(v));
    const s = u.toString();
    return s ? `?${s}` : "";
  };
  const chip = (active: boolean) =>
    `inline-block rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap ${active ? "border-charcoal bg-charcoal text-white" : "border-line hover:border-rust hover:text-rust-text"}`;

  return (
    <div className="wrap pt-10 md:pt-14">
      <h1 className="font-serif text-4xl font-bold md:text-5xl">{title}</h1>
      {intro && <p className="mt-3 max-w-2xl text-lg text-[#3b3e45]">{intro}</p>}

      <nav aria-label="Filter by subject" className="mt-8 flex gap-2 overflow-x-auto pb-1">
        <Link href={`/news${lockType ? (type === "briefing" ? "/briefings" : "/analysis") : qs({ type })}`} className={chip(!categoryId)}>
          All subjects
        </Link>
        {cats.map((c) => (
          <Link key={c.id} href={`/news/category/${c.slug}${qs({ type })}`} className={chip(categoryId === c.id)}>
            {c.name}
          </Link>
        ))}
      </nav>
      {!lockType && (
        <nav aria-label="Filter by type" className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {TYPES.map((t) => (
            <Link key={t.value} href={`${categorySlug ? `/news/category/${categorySlug}` : "/news"}${qs({ type: t.value })}`} className={chip((type || "") === t.value)}>
              {t.label}
            </Link>
          ))}
        </nav>
      )}

      <div className={`mt-6 grid gap-12 ${picks.length >= 5 ? "lg:grid-cols-[1fr_320px]" : ""}`}>
        <div>
          {items.length === 0 ? (
            <p className="py-16 text-center text-muted">Nothing published here yet.</p>
          ) : (
            items.map((a) => <ArticleRow key={a.id} a={a} />)
          )}
          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-8 flex items-center justify-between">
              {page > 1 ? (
                <Link className="btn btn-outline" href={`${basePath}${qs({ type: lockType ? undefined : type, page: page - 1 })}`}>
                  Newer
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-muted">
                Page {page} of {pages}
              </span>
              {page < pages ? (
                <Link className="btn btn-outline" href={`${basePath}${qs({ type: lockType ? undefined : type, page: page + 1 })}`}>
                  Older
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>
        {picks.length >= 5 && (
          <aside aria-label="Editors' picks">
            <h2 className="eyebrow border-b-2 border-ink pb-3">Editors&apos; picks</h2>
            <ul>
              {picks.map((a) => (
                <li key={a.id} className="border-b border-line py-4">
                  <Link href={`/news/${a.slug}`} className="font-serif text-lg font-semibold leading-snug hover:text-rust-text">
                    {a.headline}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
