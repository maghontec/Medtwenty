import Link from "next/link";
import { confirmTokens } from "@/lib/newsletters";

export const metadata = { title: "Confirm subscription", robots: { index: false } };

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const tokens = ((await searchParams).token || "").split(",").filter(Boolean).slice(0, 10);
  const n = tokens.length ? confirmTokens(tokens) : 0;
  return (
    <div className="wrap max-w-xl py-20 text-center">
      <h1 className="font-serif text-4xl font-bold">{n > 0 ? "You're subscribed" : "Nothing to confirm"}</h1>
      <p className="mt-4 text-lg text-[#3b3e45]">{n > 0 ? "Thanks for confirming. Your first email will arrive with the next issue." : "This link has already been used or has expired."}</p>
      <Link href="/" className="btn btn-primary mt-8">
        Go to MedTwenty
      </Link>
    </div>
  );
}
