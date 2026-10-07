import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "About",
  description: "MedTwenty publishes verified UK healthcare business intelligence: one story each weekday, a Friday briefing and a monthly analysis.",
  alternates: { canonical: "https://medtwenty.com/about" },
};

export default function AboutPage() {
  const s = getSettings();
  return (
    <div className="wrap max-w-[760px] pt-10 md:pt-14">
      <p className="eyebrow text-rust-text">About</p>
      <h1 className="mt-2 font-serif text-4xl font-bold md:text-5xl">{s.tagline}</h1>
      <div className="prose-mt mt-8">
        <p>
          MedTwenty covers the business of UK healthcare: the money behind the NHS, the companies that provide and supply care, healthcare technology, regulation and policy, and investment. It is a trading name of {s.company_name}.
        </p>
        <h2>What we publish</h2>
        <ul>
          <li>
            <strong>One verified story each weekday</strong>, usually 300 to 500 words: what happened, why it matters, and a link to the original source.
          </li>
          <li>
            <strong>A weekly briefing every Friday</strong>: the five most significant developments of the week with a short editorial overview.
          </li>
          <li>
            <strong>One original analysis each month</strong>, built from publicly available data.
          </li>
        </ul>
        <p>We publish less than most news sites on purpose. Every piece is chosen by an editor and checked against its primary source before it goes live.</p>
        <h2>How we work</h2>
        <p>
          Sources are monitored with AI assistance. The editor chooses which developments to cover, checks every fact, figure and quotation, and publishes. AI may help draft, but it never publishes. Read our{" "}
          <Link href="/editorial-standards">editorial standards</Link>.
        </p>
        <h2 id="rebrand">From VanadiumNews to MedTwenty</h2>
        <p>VanadiumNews is now MedTwenty. The team and the standards are the same; the name now says what we cover. Old links redirect automatically.</p>
        <h2>Contact</h2>
        <p>
          Story tips, corrections and questions: <Link href="/contact">contact the editor</Link>.
        </p>
      </div>
    </div>
  );
}
