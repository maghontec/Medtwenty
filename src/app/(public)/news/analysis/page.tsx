import type { Metadata } from "next";
import { NewsList } from "@/components/NewsList";

export const metadata: Metadata = {
  title: "Monthly analysis",
  description: "MedTwenty's monthly original analysis of UK healthcare business, built from publicly available data.",
  alternates: { canonical: "https://medtwenty.com/news/analysis" },
};

export default async function AnalysisPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  return (
    <NewsList
      title="Monthly analysis"
      intro="One original analysis each month, built from publicly available data."
      basePath="/news/analysis"
      type="analysis"
      lockType
      page={Number(sp.page) || 1}
    />
  );
}
