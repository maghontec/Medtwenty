import Link from "next/link";
import { get } from "@/lib/db";
import { unsubscribeAction } from "@/app/actions/member";

export const metadata = { title: "Unsubscribe", robots: { index: false } };

// Unsubscribing never needs sign-in: the token in the email link is enough.
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const sp = await searchParams;
  const row = sp.token
    ? get<{ name: string; email: string; status: string }>(
        "SELECT n.name, s.email, s.status FROM newsletter_subscribers s JOIN newsletters n ON n.id = s.newsletter_id WHERE s.token = ?",
        sp.token,
      )
    : undefined;
  return (
    <div className="wrap max-w-xl py-20 text-center">
      {!row ? (
        <>
          <h1 className="font-serif text-4xl font-bold">Link not recognised</h1>
          <p className="mt-4 text-[#3b3e45]">Use the unsubscribe link at the bottom of any MedTwenty email, or manage newsletters from your dashboard.</p>
        </>
      ) : row.status === "unsubscribed" || sp.done ? (
        <>
          <h1 className="font-serif text-4xl font-bold">You&apos;re unsubscribed</h1>
          <p className="mt-4 text-[#3b3e45]">
            {row.email} will no longer receive {row.name}.
          </p>
          <Link href="/newsletters" className="btn btn-outline mt-8">
            Manage newsletters
          </Link>
        </>
      ) : (
        <>
          <h1 className="font-serif text-4xl font-bold">Unsubscribe from {row.name}?</h1>
          <p className="mt-4 text-[#3b3e45]">{row.email}</p>
          <form action={unsubscribeAction} className="mt-8">
            <input type="hidden" name="token" value={sp.token} />
            <button className="btn btn-primary">Unsubscribe</button>
          </form>
        </>
      )}
    </div>
  );
}
