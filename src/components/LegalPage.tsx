import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { get } from "@/lib/db";
import { renderMarkdown } from "@/lib/markdown";
import { formatDate } from "@/lib/time";

function page(slug: string) {
  return get<{ title: string; body: string; updated_at: string }>("SELECT title, body, updated_at FROM legal_pages WHERE slug = ?", slug);
}

export function legalMetadata(slug: string): Metadata {
  const p = page(slug);
  return p ? { title: p.title, description: `MedTwenty ${p.title.toLowerCase()}.`, alternates: { canonical: `https://medtwenty.com/${slug}` } } : {};
}

export function LegalPage({ slug }: { slug: string }) {
  const p = page(slug);
  if (!p) notFound();
  return (
    <div className="wrap max-w-[760px] pt-10 md:pt-14">
      <h1 className="font-serif text-4xl font-bold">{p.title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated {formatDate(p.updated_at)}</p>
      <div className="prose-mt mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.body) }} />
    </div>
  );
}
