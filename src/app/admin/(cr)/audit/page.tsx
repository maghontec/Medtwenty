import { requireStaff } from "@/lib/auth";
import { all } from "@/lib/db";
import { formatDateTime } from "@/lib/time";
import { PageHead } from "../ui";

export const metadata = { title: "Audit log" };

export default async function Audit({ searchParams }: { searchParams: Promise<{ actor?: string; entity?: string; action?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const where: string[] = [];
  const p: unknown[] = [];
  if (sp.actor) { where.push("actor_email LIKE ?"); p.push(`%${sp.actor}%`); }
  if (sp.entity) { where.push("entity = ?"); p.push(sp.entity); }
  if (sp.action) { where.push("action LIKE ?"); p.push(`%${sp.action}%`); }
  const rows = all<{ id: number; actor_email: string; action: string; entity: string; entity_id: string | null; before_json: string | null; after_json: string | null; created_at: string }>(
    `SELECT * FROM audit_log ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT 300`,
    ...p,
  );
  const entities = all<{ entity: string }>("SELECT DISTINCT entity FROM audit_log WHERE entity IS NOT NULL ORDER BY 1");
  return (
    <>
      <PageHead title="Audit log" sub="Every staff change, with before and after." />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="actor" defaultValue={sp.actor} placeholder="Actor email" className="input w-56 py-1.5 text-sm" aria-label="Actor" />
        <input name="action" defaultValue={sp.action} placeholder="Action" className="input w-40 py-1.5 text-sm" aria-label="Action" />
        <select name="entity" defaultValue={sp.entity || ""} className="input w-auto py-1.5 text-sm" aria-label="Entity">
          <option value="">All entities</option>
          {entities.map((e) => <option key={e.entity}>{e.entity}</option>)}
        </select>
        <button className="btn btn-outline btn-sm">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table min-w-[900px]">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Change</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-muted">{formatDateTime(r.created_at)}</td>
                <td>{r.actor_email}</td>
                <td className="font-medium">{r.action}</td>
                <td className="text-muted">{r.entity}{r.entity_id ? ` #${r.entity_id}` : ""}</td>
                <td className="max-w-lg">
                  {(r.before_json || r.after_json) && (
                    <details>
                      <summary className="cursor-pointer text-xs underline">Diff</summary>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <pre className="overflow-x-auto rounded bg-[#f6e2e0] p-2 text-[11px]">{r.before_json ? JSON.stringify(JSON.parse(r.before_json), null, 1) : "—"}</pre>
                        <pre className="overflow-x-auto rounded bg-[#e3efe6] p-2 text-[11px]">{r.after_json ? JSON.stringify(JSON.parse(r.after_json), null, 1) : "—"}</pre>
                      </div>
                    </details>
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
