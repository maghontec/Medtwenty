import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { all } from "@/lib/db";
import { newArticleAction } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/time";
import { Badge, PageHead } from "../ui";

export const metadata = { title: "Articles" };

export default async function Articles() {
  await requireStaff();
  const rows = all<{ id: number; headline: string; status: string; content_type: string; updated_at: string }>(
    "SELECT id, headline, status, content_type, updated_at FROM articles ORDER BY updated_at DESC LIMIT 100",
  );
  return (
    <>
      <PageHead
        title="Article editor"
        sub="Start from the Shortlist where you can, so the source and facts carry over."
        actions={
          <form action={newArticleAction} className="flex gap-2">
            <button name="type" value="story" className="btn btn-primary btn-sm">New story</button>
            <button name="type" value="analysis" className="btn btn-outline btn-sm">New analysis</button>
          </form>
        }
      />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Headline</th><th>Type</th><th>Status</th><th>Updated</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/articles/${r.id}`} className="font-medium hover:underline">{r.headline}</Link></td>
                <td className="text-muted">{r.content_type}</td>
                <td><Badge s={r.status} /></td>
                <td className="whitespace-nowrap text-muted">{formatDateTime(r.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
