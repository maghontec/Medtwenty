import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { all } from "@/lib/db";
import { dealLabel, type Deal } from "@/lib/content";
import { dealAction } from "@/app/actions/admin";
import { Flash, PageHead, Panel } from "../ui";
import { ConfirmButton } from "@/components/client";

export const metadata = { title: "Deals" };

export default async function DealsAdmin({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const deals = all<Deal & { headline: string | null }>("SELECT d.*, a.headline FROM deals d LEFT JOIN articles a ON a.id = d.article_id ORDER BY d.announced_on DESC, d.id DESC");
  return (
    <>
      <PageHead title="Deals" sub="Only verified deals appear publicly. Deals linked to a story are verified when the story is published." />
      <Flash sp={sp} />
      <Panel title="Add a deal" className="mb-6">
        <form action={dealAction} className="grid gap-2 md:grid-cols-5">
          <select name="deal_type" className="input" aria-label="Type"><option value="acquisition">Acquisition</option><option value="funding">Funding</option><option value="restructuring">Restructuring</option></select>
          <input name="acquirer" placeholder="Acquirer / lead" className="input" aria-label="Acquirer" />
          <input name="target" placeholder="Target / company" required className="input" aria-label="Target" />
          <input name="value_text" placeholder="Value text (e.g. £750m)" className="input" aria-label="Value" />
          <input name="value_usd_m" type="number" step="0.1" placeholder="USD millions" className="input" aria-label="Value in USD millions" />
          <input name="round" placeholder="Round" className="input" aria-label="Round" />
          <input name="investors" placeholder="Investors" className="input" aria-label="Investors" />
          <input name="sector" placeholder="Sector" className="input" aria-label="Sector" />
          <select name="status" className="input" aria-label="Status"><option>announced</option><option>closed</option><option>rumoured</option></select>
          <input name="announced_on" type="date" className="input" aria-label="Date" />
          <button className="btn btn-dark md:col-span-5 md:justify-self-start">Add (unverified)</button>
        </form>
      </Panel>
      <div className="card overflow-x-auto">
        <table className="table min-w-[900px]">
          <thead><tr><th>Deal</th><th>Value</th><th>Status</th><th>Date</th><th>Story</th><th>Verified</th><th /></tr></thead>
          <tbody>
            {deals.map((d) => (
              <tr key={d.id}>
                <td className="font-medium">{dealLabel(d)}<p className="text-xs text-muted">{d.deal_type}{d.round ? ` · ${d.round}` : ""}{d.sector ? ` · ${d.sector}` : ""}</p></td>
                <td>{d.value_text || "Undisclosed"}</td>
                <td className="text-muted">{d.status}</td>
                <td className="whitespace-nowrap text-muted">{d.announced_on}</td>
                <td>{d.article_id ? <Link href={`/admin/articles/${d.article_id}`} className="text-xs underline">{d.headline}</Link> : "—"}</td>
                <td>{d.verified ? <span className="text-up">Yes</span> : <span className="text-muted">No</span>}</td>
                <td>
                  <form action={dealAction} className="flex gap-1">
                    <input type="hidden" name="id" value={d.id} />
                    <button name="op" value="toggle_verified" className="btn btn-outline btn-sm">{d.verified ? "Unverify" : "Verify"}</button>
                    <ConfirmButton name="op" value="delete" message="Delete this deal?">Delete</ConfirmButton>
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
