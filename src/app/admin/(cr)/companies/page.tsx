import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { all } from "@/lib/db";
import type { Company } from "@/lib/content";
import { companyAction } from "@/app/actions/admin";
import { Flash, PageHead, Panel } from "../ui";

export const metadata = { title: "Companies" };

export default async function CompaniesAdmin({ searchParams }: { searchParams: Promise<{ q?: string; edit?: string; msg?: string; err?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const rows = all<Company & { stories: number; followers: number }>(
    `SELECT c.*, (SELECT COUNT(*) FROM article_entities e WHERE e.entity_type = 'company' AND e.entity_id = c.id) AS stories,
      (SELECT COUNT(*) FROM watchlist_items w WHERE w.company_id = c.id) AS followers
     FROM companies c ${sp.q ? "WHERE c.name LIKE ?" : ""} ORDER BY c.name LIMIT 500`,
    ...(sp.q ? [`%${sp.q}%`] : []),
  );
  const editing = sp.edit ? rows.find((r) => r.id === Number(sp.edit)) : undefined;
  return (
    <>
      <PageHead title="Companies" sub="Companies are added as stories mention them. Stubs are hidden from search engines until you fill them in." />
      <Flash sp={sp} />
      <Panel title={editing ? `Edit ${editing.name}` : "Add a company"} className="mb-6">
        <form action={companyAction} className="grid gap-2 md:grid-cols-3">
          <input type="hidden" name="op" value={editing ? "update" : "create"} />
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <input name="name" required defaultValue={editing?.name} placeholder="Name" className="input" aria-label="Name" />
          <input name="sector" defaultValue={editing?.sector || ""} placeholder="Sector" className="input" aria-label="Sector" />
          <input name="country" defaultValue={editing?.country || "GB"} placeholder="Country" className="input" aria-label="Country" />
          <input name="website" defaultValue={editing?.website || ""} placeholder="Website" className="input" aria-label="Website" />
          <input name="description" defaultValue={editing?.description || ""} placeholder="Short description" className="input md:col-span-2" aria-label="Description" />
          {editing && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_stub" defaultChecked={!!editing.is_stub} /> Stub</label>}
          <button className="btn btn-dark md:justify-self-start">{editing ? "Save" : "Add"}</button>
        </form>
      </Panel>
      <form className="mb-3"><input name="q" defaultValue={sp.q} placeholder="Search" className="input w-64 py-1.5 text-sm" aria-label="Search companies" /></form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Name</th><th>Sector</th><th>Stories</th><th>Followers</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="font-medium"><Link href={`/companies/${c.slug}`} target="_blank" className="hover:underline">{c.name}</Link>{c.is_stub ? <span className="ml-2 text-xs text-muted">stub</span> : null}</td>
                <td className="text-muted">{c.sector}</td>
                <td>{c.stories}</td>
                <td>{c.followers}</td>
                <td><Link href={`/admin/companies?edit=${c.id}`} className="text-sm underline">Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
