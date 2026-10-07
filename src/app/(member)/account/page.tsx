import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { deleteAccountAction } from "@/app/actions/member";
import { formatDate } from "@/lib/time";

export const metadata = { title: "Account and privacy" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { error } = await searchParams;
  return (
    <div className="wrap max-w-2xl space-y-6 py-10">
      <h1 className="font-serif text-3xl font-bold">Account and privacy</h1>
      {error && <p role="alert" className="rounded bg-[#f6e2e0] px-4 py-3 text-down">{error}</p>}
      <section className="card p-6">
        <h2 className="eyebrow text-muted">Your account</h2>
        <p className="mt-3">{user.email}</p>
        <p className="text-sm text-muted">Member since {formatDate(user.created_at)}</p>
        <Link href="/forgot" className="mt-4 inline-block text-sm font-semibold text-rust-text underline">Change password</Link>
      </section>
      <section className="card p-6">
        <h2 className="eyebrow text-muted">Download your data</h2>
        <p className="mt-3 text-sm">A JSON file with your account, subscriptions, newsletter consents, followed companies and Premium reads.</p>
        <a href="/account/export" className="btn btn-outline btn-sm mt-4" download>Download my data</a>
      </section>
      <section className="card border-down/40 p-6">
        <h2 className="eyebrow text-down">Delete account</h2>
        <p className="mt-3 text-sm">This deletes your account and unsubscribes you from every newsletter. Billing records we must keep for tax are kept without your account details. Cancel any active Premium subscription first.</p>
        <form action={deleteAccountAction} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="confirm" className="sr-only">Type DELETE to confirm</label>
          <input id="confirm" name="confirm" placeholder="Type DELETE to confirm" className="input sm:max-w-xs" />
          <button className="btn btn-danger">Delete my account</button>
        </form>
      </section>
    </div>
  );
}
