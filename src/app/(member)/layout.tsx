import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";
import { logoutAction } from "@/app/actions/auth";
import { tick } from "@/lib/editorial";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  await tick();
  const ent = entitlementFor(user);
  const dash = ent.premium ? "/premium-dashboard" : "/dashboard";
  const initial = (user.name || user.email).charAt(0).toUpperCase();
  return (
    <div className="min-h-screen bg-cream-2 pb-20 md:pb-0">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="bg-charcoal text-white">
        <div className="wrap flex h-14 items-center justify-between gap-4">
          <Link href={dash} className="font-serif text-lg font-bold">
            Med<span className="text-rust-light">Twenty</span> <span className="font-sans text-sm font-normal text-white/70">Intelligence</span>
          </Link>
          <form action="/search" role="search" className="hidden flex-1 md:block md:max-w-sm">
            <label htmlFor="m-search" className="sr-only">Search</label>
            <input id="m-search" name="q" placeholder="Search" className="w-full rounded-md bg-charcoal-2 px-3 py-1.5 text-sm text-white placeholder:text-white/50" />
          </form>
          <nav aria-label="Member" className="flex items-center gap-4 text-sm">
            <Link href="/" className="hidden text-white/80 hover:text-white sm:inline">Home</Link>
            <details className="relative">
              <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full bg-rust font-semibold" aria-label="Account menu">
                {initial}
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-md bg-white p-2 text-ink shadow-lg">
                <p className="truncate px-3 py-2 text-xs text-muted">{user.email}</p>
                <Link href={dash} className="block rounded px-3 py-2 hover:bg-cream">Dashboard</Link>
                <Link href="/account" className="block rounded px-3 py-2 hover:bg-cream">Account and privacy</Link>
                <Link href="/account/billing" className="block rounded px-3 py-2 hover:bg-cream">Plan and billing</Link>
                <form action={logoutAction}>
                  <button className="w-full rounded px-3 py-2 text-left hover:bg-cream">Sign out</button>
                </form>
              </div>
            </details>
          </nav>
        </div>
      </header>
      <main id="main">{children}</main>
      <nav aria-label="Member tabs" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-white text-center text-xs md:hidden">
        <Link href="/" className="py-3">Home</Link>
        <Link href={dash} className="py-3">Dashboard</Link>
        <Link href="/search" className="py-3">Search</Link>
        <Link href="/account" className="py-3">Account</Link>
      </nav>
    </div>
  );
}
