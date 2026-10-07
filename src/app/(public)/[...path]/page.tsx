import { notFound, permanentRedirect } from "next/navigation";
import { get } from "@/lib/db";

// Old VanadiumNews URLs and other legacy paths, from the editable redirects table.
export default async function Legacy({ params }: { params: Promise<{ path: string[] }> }) {
  const p = "/" + (await params).path.map(decodeURIComponent).join("/");
  const r = get<{ to_path: string }>("SELECT to_path FROM redirects WHERE from_path = ? OR from_path = ?", p, p.replace(/\/$/, ""));
  if (r) permanentRedirect(r.to_path);
  notFound();
}
