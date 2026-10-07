import Link from "next/link";
import { all } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { entitlementFor } from "@/lib/entitlements";
import type { User } from "@/lib/auth";
import { compGrantAction, roleAction } from "@/app/actions/admin";
import { formatDate, formatDateTime } from "@/lib/time";
import { Flash, PageHead, Panel } from "../ui";

export const metadata = { title: "Members" };

export default async function Members({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string; status?: string; msg?: string; err?: string }> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const isSuper = staff.roles.includes("super_admin");
  const tab = sp.tab || "members";
  const tabs = (
    <div className="mb-6 flex gap-2 text-sm">
      {[["members", "Members"], ["comp", "Complimentary"], ["staff", "Staff"], ["messages", "Contact messages"]].map(([v, l]) => (
        <Link key={v} href={`/admin/members?tab=${v}`} className={`rounded-full border px-3 py-1 ${tab === v ? "border-charcoal bg-charcoal text-white" : "border-line bg-white"}`}>{l}</Link>
      ))}
    </div>
  );

  if (tab === "comp") {
    const grants = all<{ id: number; email: string; plan_code: string; until: string | null; revoked_at: string | null; created_at: string }>("SELECT * FROM comp_grants ORDER BY id DESC");
    return (
      <>
        <PageHead title="Members" />
        {tabs}
        <Flash sp={sp} />
        {isSuper && (
          <Panel title="Grant complimentary access" className="mb-6">
            <form action={compGrantAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="back" value="/admin/members?tab=comp" />
              <div><label className="label" htmlFor="ce">Email</label><input id="ce" name="email" type="email" required className="input" /></div>
              <div><label className="label" htmlFor="cp">Plan</label><select id="cp" name="plan_code" className="input"><option value="premium">Premium</option></select></div>
              <div><label className="label" htmlFor="cu">Until (optional)</label><input id="cu" name="until" type="date" className="input" /></div>
              <button className="btn btn-dark">Grant</button>
            </form>
          </Panel>
        )}
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Email</th><th>Plan</th><th>Until</th><th>Status</th><th /></tr></thead>
            <tbody>
              {grants.map((g) => (
                <tr key={g.id}>
                  <td>{g.email}</td>
                  <td>{g.plan_code}</td>
                  <td>{g.until ? formatDate(g.until) : "No end date"}</td>
                  <td>{g.revoked_at ? <span className="text-muted">Revoked {formatDate(g.revoked_at)}</span> : <span className="text-up">Active</span>}</td>
                  <td>
                    {isSuper && !g.revoked_at && (
                      <form action={compGrantAction}><input type="hidden" name="email" value={g.email} /><input type="hidden" name="op" value="revoke" /><input type="hidden" name="back" value="/admin/members?tab=comp" /><button className="btn btn-outline btn-sm">Revoke</button></form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (tab === "staff") {
    const rows = all<{ email: string; role: string }>("SELECT u.email, r.role FROM user_roles r JOIN users u ON u.id = r.user_id ORDER BY u.email");
    return (
      <>
        <PageHead title="Members" />
        {tabs}
        <Flash sp={sp} />
        {isSuper && (
          <Panel title="Add a staff role" className="mb-6">
            <p className="mb-3 text-sm text-muted">The person needs a MedTwenty account first. They then sign in at /admin/login.</p>
            <form action={roleAction} className="flex flex-wrap items-end gap-2">
              <div><label className="label" htmlFor="re">Email</label><input id="re" name="email" type="email" required className="input" /></div>
              <div><label className="label" htmlFor="rr">Role</label><select id="rr" name="role" className="input"><option value="editor">Editor</option><option value="contributor">Contributor</option></select></div>
              <button className="btn btn-dark">Add role</button>
            </form>
          </Panel>
        )}
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>Email</th><th>Role</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.email + r.role}>
                  <td>{r.email}</td>
                  <td>{r.role.replace("_", " ")}</td>
                  <td>{isSuper && <form action={roleAction}><input type="hidden" name="email" value={r.email} /><input type="hidden" name="role" value={r.role} /><input type="hidden" name="op" value="remove" /><button className="btn btn-outline btn-sm">Remove</button></form>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (tab === "messages") {
    const msgs = all<{ id: number; name: string | null; email: string; message: string; created_at: string }>("SELECT * FROM contact_messages ORDER BY id DESC LIMIT 200");
    return (
      <>
        <PageHead title="Members" />
        {tabs}
        <div className="space-y-3">
          {msgs.length === 0 && <p className="text-muted">No messages.</p>}
          {msgs.map((m) => (
            <div key={m.id} className="card p-4">
              <p className="text-sm font-semibold">{m.name || "Anonymous"} · <a href={`mailto:${m.email}`} className="underline">{m.email}</a> <span className="font-normal text-muted">· {formatDateTime(m.created_at)}</span></p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{m.message}</p>
            </div>
          ))}
        </div>
      </>
    );
  }

  const where: string[] = [];
  const p: unknown[] = [];
  if (sp.q) { where.push("u.email LIKE ?"); p.push(`%${sp.q}%`); }
  if (sp.status) { where.push("EXISTS (SELECT 1 FROM subscriptions s WHERE s.user_id = u.id AND s.status = ?)"); p.push(sp.status); }
  const users = all<User>(`SELECT u.* FROM users u ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY u.created_at DESC LIMIT 200`, ...p);
  return (
    <>
      <PageHead title="Members" sub={`${users.length} shown`} />
      {tabs}
      <Flash sp={sp} />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Search by email" className="input w-72 py-1.5 text-sm" aria-label="Search by email" />
        <select name="status" defaultValue={sp.status || ""} className="input w-auto py-1.5 text-sm" aria-label="Subscription status">
          <option value="">Any status</option><option value="active">Active</option><option value="past_due">Past due</option><option value="canceled">Cancelled</option>
        </select>
        <button className="btn btn-outline btn-sm">Search</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table min-w-[800px]">
          <thead><tr><th>Email</th><th>Plan</th><th>Status</th><th>Renewal</th><th>Source</th><th>Joined</th><th /></tr></thead>
          <tbody>
            {users.map((u) => {
              const e = entitlementFor(u);
              return (
                <tr key={u.id}>
                  <td>{u.email}{!u.email_confirmed_at && <span className="ml-2 text-xs text-muted">unconfirmed</span>}</td>
                  <td>{e.premium ? "Premium" : "Free"}{e.source === "comp" ? " (comp)" : ""}</td>
                  <td className="text-muted">{e.subscription?.status || "—"}{e.subscription?.cancel_at_period_end ? " · cancelling" : ""}</td>
                  <td className="whitespace-nowrap text-muted">{e.renewal ? formatDate(e.renewal) : "—"}</td>
                  <td className="text-muted">{e.subscription?.conversion_source || "—"}</td>
                  <td className="whitespace-nowrap text-muted">{formatDate(u.created_at)}</td>
                  <td>
                    {isSuper && !e.premium && (
                      <form action={compGrantAction}><input type="hidden" name="email" value={u.email} /><input type="hidden" name="plan_code" value="premium" /><button className="btn btn-outline btn-sm">Grant Premium</button></form>
                    )}
                    {isSuper && e.source === "comp" && (
                      <form action={compGrantAction}><input type="hidden" name="email" value={u.email} /><input type="hidden" name="op" value="revoke" /><button className="btn btn-outline btn-sm">Revoke comp</button></form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
