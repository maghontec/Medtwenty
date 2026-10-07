import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { all } from "@/lib/db";
import type { RegDecision } from "@/lib/content";
import { decisionAction } from "@/app/actions/admin";
import { Flash, PageHead, Panel } from "../ui";
import { ConfirmButton } from "@/components/client";

export const metadata = { title: "Regulatory decisions" };

export default async function RegulatoryAdmin({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const rows = all<RegDecision & { headline: string | null }>("SELECT r.*, a.headline FROM regulatory_decisions r LEFT JOIN articles a ON a.id = r.article_id ORDER BY r.decided_on DESC, r.id DESC");
  return (
    <>
      <PageHead title="Regulatory decisions" sub="Only verified decisions appear in the public Regulatory Pipeline." />
      <Flash sp={sp} />
      <Panel title="Add a decision" className="mb-6">
        <form action={decisionAction} className="grid gap-2 md:grid-cols-4">
          <input type="hidden" name="op" value="create" />
          <input name="product" placeholder="Product or subject" required className="input" aria-label="Product" />
          <input name="company" placeholder="Company" className="input" aria-label="Company" />
          <input name="regulator" placeholder="Regulator" defaultValue="MHRA" className="input" aria-label="Regulator" />
          <select name="decision" className="input" aria-label="Decision"><option>approved</option><option>rejected</option><option>pending</option><option>guidance</option></select>
          <input name="decided_on" type="date" className="input" aria-label="Date" />
          <input name="summary" placeholder="One-line summary" className="input md:col-span-2" aria-label="Summary" />
          <button className="btn btn-dark">Add (unverified)</button>
        </form>
      </Panel>
      <div className="card overflow-x-auto">
        <table className="table min-w-[800px]">
          <thead><tr><th>Subject</th><th>Regulator</th><th>Decision</th><th>Date</th><th>Story</th><th>Verified</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.product}{r.company && <p className="text-xs text-muted">{r.company}</p>}</td>
                <td>{r.regulator}</td>
                <td className="text-muted">{r.decision}</td>
                <td className="whitespace-nowrap text-muted">{r.decided_on}</td>
                <td>{r.article_id ? <Link href={`/admin/articles/${r.article_id}`} className="text-xs underline">{r.headline}</Link> : "—"}</td>
                <td>{r.verified ? <span className="text-up">Yes</span> : <span className="text-muted">No</span>}</td>
                <td>
                  <form action={decisionAction} className="flex gap-1">
                    <input type="hidden" name="id" value={r.id} />
                    <button name="op" value="toggle_verified" className="btn btn-outline btn-sm">{r.verified ? "Unverify" : "Verify"}</button>
                    <ConfirmButton name="op" value="delete" message="Delete this decision?">Delete</ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
