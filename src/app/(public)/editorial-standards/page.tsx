import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Editorial standards",
  description: "How MedTwenty selects, verifies and corrects its stories, and how we use AI.",
  alternates: { canonical: "https://medtwenty.com/editorial-standards" },
};

export default function StandardsPage() {
  return (
    <div className="wrap max-w-[760px] pt-10 md:pt-14">
      <h1 className="font-serif text-4xl font-bold md:text-5xl">Editorial standards</h1>
      <div className="prose-mt mt-8">
        <h2>Selection</h2>
        <p>We monitor regulators, government departments, the NHS, company announcements, filings and trade press, with AI assistance to screen and summarise. The editor decides what to cover, using four tests: is it material to healthcare businesses, investors or decision-makers; is there a reliable primary source; can we add something beyond the headline; and can we do it well in the time available.</p>
        <h2>Verification</h2>
        <p>Every fact, figure, date, name and quotation is checked against the primary source before publication. A story cannot be published in our system until each material fact has been marked verified by the editor.</p>
        <h2>Use of AI</h2>
        <p>AI tools help us monitor sources and may produce a first draft. A human selects every story, verifies every fact and publishes. Nothing is published automatically.</p>
        <h2>Credit and sourcing</h2>
        <p>Our summaries credit and link to original reporting and primary documents rather than reproducing them. Every story carries a source line.</p>
        <h2>Corrections</h2>
        <p>
          If we get something wrong, we correct it promptly and add a dated note to the article explaining what changed. Serious errors lead to a retraction notice. Report an error through our <Link href="/contact">contact page</Link>.
        </p>
        <h2>Independence</h2>
        <p>MedTwenty does not accept payment for coverage. Our indices and trackers are editorial indicators and business information, not investment, financial, legal or medical advice.</p>
      </div>
    </div>
  );
}
