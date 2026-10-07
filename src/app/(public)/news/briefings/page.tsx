import type { Metadata } from "next";
import { NewsList } from "@/components/NewsList";

export const metadata: Metadata = {
  title: "Weekly briefings",
  description: "The MedTwenty Weekly: the five most significant UK healthcare business developments each week, with an editorial overview.",
  alternates: { canonical: "https://medtwenty.com/news/briefings" },
};

export default async function BriefingsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  return (
    <NewsList
      title="Weekly briefings"
      intro="Every Friday: the five most significant developments of the week, with an editorial overview."
      basePath="/news/briefings"
      type="briefing"
      lockType
      page={Number(sp.page) || 1}
    />
  );
}
