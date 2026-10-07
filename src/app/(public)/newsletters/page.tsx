import type { Metadata } from "next";
import { activeNewsletters } from "@/lib/content";
import { currentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";
import { NewsletterForm } from "@/components/NewsletterForm";

export const metadata: Metadata = {
  title: "Newsletters",
  description: "The Daily Story, The MedTwenty Weekly and The Analyst Note: MedTwenty by email.",
  alternates: { canonical: "https://medtwenty.com/newsletters" },
};

export default async function NewslettersPage() {
  const user = await currentUser();
  const ent = entitlementFor(user);
  const list = activeNewsletters();
  return (
    <div className="wrap pt-10 md:pt-14">
      <h1 className="font-serif text-4xl font-bold md:text-5xl">Newsletters</h1>
      <p className="mt-3 max-w-2xl text-lg text-[#3b3e45]">Three newsletters, each matching something we actually publish. Unsubscribe from any of them with one click.</p>
      <div className="mt-10">
        <NewsletterForm newsletters={list} source="newsletters_page" defaultEmail={user?.email} premium={ent.premium} />
      </div>
    </div>
  );
}
