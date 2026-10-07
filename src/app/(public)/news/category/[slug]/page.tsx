import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { categoryById, categoryBySlug } from "@/lib/content";
import { NewsList } from "@/components/NewsList";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ type?: string; page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = categoryBySlug((await params).slug);
  if (!c || !c.is_active) return {};
  return {
    title: c.name,
    description: c.description || `MedTwenty coverage of ${c.name}.`,
    alternates: { canonical: `https://medtwenty.com/news/category/${c.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const c = categoryBySlug((await params).slug);
  if (!c) notFound();
  if (!c.is_active) {
    // Old categories 301 to their new home.
    const target = c.redirect_to_id ? categoryById(c.redirect_to_id) : undefined;
    permanentRedirect(target ? `/news/category/${target.slug}` : "/news");
  }
  const sp = await searchParams;
  const type = ["story", "briefing", "analysis"].includes(sp.type || "") ? sp.type : undefined;
  return (
    <NewsList
      title={c.name}
      intro={c.description || undefined}
      basePath={`/news/category/${c.slug}`}
      categoryId={c.id}
      categorySlug={c.slug}
      type={type}
      page={Number(sp.page) || 1}
    />
  );
}
