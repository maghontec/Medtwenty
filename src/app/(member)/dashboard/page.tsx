import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";
import { Dashboard } from "../Dashboard";

export const metadata = { title: "Your dashboard" };

export default async function FreeDashboard({ searchParams }: { searchParams: Promise<{ limit?: string; confirmed?: string; upgrade?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const ent = entitlementFor(user);
  if (ent.premium) redirect("/premium-dashboard");
  const sp = await searchParams;
  return <Dashboard user={user} ent={ent} flags={{ limit: !!sp.limit, confirmed: !!sp.confirmed, upgrade: !!sp.upgrade }} />;
}
