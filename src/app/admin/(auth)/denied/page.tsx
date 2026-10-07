import Link from "next/link";
import { currentStaffSession, SUPER_ADMIN_EMAIL } from "@/lib/auth";
import { claimSuperAdminAction, staffLogoutAction } from "@/app/actions/auth";

export default async function Denied() {
  const s = await currentStaffSession();
  const canClaim = !!s && s.email.toLowerCase() === SUPER_ADMIN_EMAIL && s.roles.length === 0;
  return (
    <div className="w-full max-w-sm rounded-lg bg-white p-8 text-center">
      <h1 className="font-serif text-2xl font-bold">Access denied</h1>
      <p className="mt-2 text-sm text-muted">This area is for MedTwenty staff.</p>
      {canClaim && (
        <form action={claimSuperAdminAction} className="mt-6">
          <button className="btn btn-primary w-full">Claim super admin</button>
        </form>
      )}
      <div className="mt-6 flex justify-center gap-4 text-sm">
        {s ? (
          <form action={staffLogoutAction}>
            <button className="underline">Sign out</button>
          </form>
        ) : (
          <Link href="/admin/login" className="underline">Staff sign in</Link>
        )}
        <Link href="/" className="underline">MedTwenty</Link>
      </div>
    </div>
  );
}
