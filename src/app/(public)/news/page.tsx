import type { Metadata } from "next";
import { NewsList } from "@/components/NewsList";

export const metadata: Metadata = {
  title: "News",
  description: "Every verified MedTwenty story, briefing and analysis, newest first.",
  alternates: { canonical: "https://medtwenty.com/news" },
};

export default async function NewsPage({ searchParams }: { searchParams: Promise<{ type?: string; page?: string }> }) {
  const sp = await searchParams;
  const type = ["story", "briefing", "analysis"].includes(sp.type || "") ? sp.type : undefined;
  return <NewsList title="News" intro="One verified story each weekday, a briefing every Friday and an original analysis each month." basePath="/news" type={type} page={Number(sp.page) || 1} />;
}
