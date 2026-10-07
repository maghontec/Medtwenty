import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";
import { Dashboard } from "../Dashboard";

export const metadata = { title: "Premium dashboard" };

export default async function PremiumDashboard({ searchParams }: { searchParams: Promise<{ welcome?: string; limit?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const ent = entitlementFor(user);
  const sp = await searchParams;
  // Stripe redirects here before the webhook may have landed; show a short wait instead of bouncing.
  if (!ent.premium) {
    if (sp.welcome) {
      return (
        <div className="wrap max-w-lg py-20 text-center">
          <meta httpEquiv="refresh" content="3" />
          <h1 className="font-serif text-3xl font-bold">Confirming your payment…</h1>
          <p className="mt-3 text-muted">This usually takes a few seconds. This page will refresh.</p>
        </div>
      );
    }
    redirect("/dashboard?upgrade=1");
  }
  return <Dashboard user={user} ent={ent} flags={{ welcome: !!sp.welcome, limit: !!sp.limit }} />;
}
