import { NextResponse } from "next/server";
import { authorize, readJson, trigramSimilarity, validate, type Schema } from "@/lib/ingest";
import { all, get, run, scalar, tx } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { slugify } from "@/lib/format";

const CATEGORIES = ["nhs-healthcare-finance", "healthcare-companies", "healthcare-technology", "regulation-policy", "investment-markets"];
const str = (max = 500, required = false) => ({ type: "string" as const, max, required });
const COMPANY: Schema = { name: str(200, true), slug: str(120), website: str(300), country: str(2), sector: str(100) };
const EXEC: Schema = { name: str(200, true), title: str(200), company: str(200) };
const INVESTOR: Schema = { name: str(200, true), website: str(300) };
const DEAL: Schema = { deal_type: { type: "string", enum: ["acquisition", "funding", "restructuring"] }, acquirer: str(200), target: str(200, true), value_text: str(60), value_usd_m: { type: "number" }, status: { type: "string", enum: ["announced", "closed", "rumoured"] }, sector: str(100), announced_on: str(10) };
const ROUND: Schema = { company: str(200, true), round: str(60), value_text: str(60), value_usd_m: { type: "number" }, investors: str(500), announced_on: str(10) };
const REG: Schema = { product: str(300, true), company: str(200), regulator: str(100, true), decision: { type: "string", enum: ["approved", "rejected", "pending", "guidance"] }, decided_on: str(10), summary: str(1000) };
const APPT: Schema = { person: str(200, true), role: str(200), company: str(200) };
const ITEM: Schema = {
  external_id: str(200, true),
  source_id: { type: "integer" },
  source_url: str(2000, true),
  source_outlet: str(200),
  published_at: str(40),
  suggested_category: { type: "string", enum: CATEGORIES },
  raw_title: str(500, true),
  ai_summary: str(1000),
  significance_score: { type: "integer", min: 0, max: 100 },
  companies: { type: "array", of: COMPANY, max: 50 },
  executives: { type: "array", of: EXEC, max: 50 },
  investors: { type: "array", of: INVESTOR, max: 50 },
  deals: { type: "array", of: DEAL, max: 20 },
  funding_rounds: { type: "array", of: ROUND, max: 20 },
  regulatory_decisions: { type: "array", of: REG, max: 20 },
  appointments: { type: "array", of: APPT, max: 50 },
};
const BODY: Schema = { items: { type: "array", of: ITEM, max: 50, required: true } };

type Co = { name: string; slug?: string; website?: string; country?: string; sector?: string };

function matchCompany(c: Co): number {
  if (c.slug) {
    const r = get<{ id: number }>("SELECT id FROM companies WHERE slug = ?", c.slug);
    if (r) return r.id;
  }
  if (c.website) {
    const host = c.website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
    const r = get<{ id: number }>("SELECT id FROM companies WHERE lower(replace(replace(replace(website,'https://',''),'http://',''),'www.','')) LIKE ?", `${host}%`);
    if (r) return r.id;
  }
  const country = (c.country || "GB").toUpperCase();
  const candidates = all<{ id: number; name: string }>("SELECT id, name FROM companies WHERE COALESCE(country, 'GB') = ?", country);
  for (const x of candidates) if (trigramSimilarity(x.name, c.name) > 0.9) return x.id;
  let slug = slugify(c.slug || c.name) || "company";
  let n = 2;
  while (get("SELECT 1 FROM companies WHERE slug = ?", slug)) slug = `${slugify(c.name)}-${n++}`;
  return run("INSERT INTO companies (slug, name, sector, country, website, is_stub, source) VALUES (?, ?, ?, ?, ?, 1, 'ingest')", slug, c.name, c.sector || null, country, c.website || null).lastId;
}

export async function POST(req: Request) {
  const denied = authorize(req);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await readJson(req);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const errors = validate(body, BODY);
  if (errors.length) return NextResponse.json({ error: "Validation failed", details: errors.slice(0, 50) }, { status: 400 });
  const s = getSettings();
  if (s.ingest_paused) return NextResponse.json({ error: "Ingestion is paused" }, { status: 423 });

  const items = (body as { items: Record<string, unknown>[] }).items;
  const dayStart = new Date().toISOString().slice(0, 10) + "T00:00:00Z";
  let today = scalar<number>("SELECT COUNT(*) FROM extracted_items WHERE origin = 'ingest' AND created_at >= ?", dayStart) ?? 0;
  const results: { external_id: string; id?: number; status: string }[] = [];

  for (const it of items) {
    const ext = String(it.external_id);
    const existing = get<{ id: number }>("SELECT id FROM extracted_items WHERE external_id = ?", ext);
    if (existing) {
      results.push({ external_id: ext, id: existing.id, status: "duplicate" });
      continue;
    }
    if (today >= s.ingest_daily_cap) {
      results.push({ external_id: ext, status: "over_daily_cap" });
      continue;
    }
    if (!/^https?:\/\//.test(String(it.source_url))) {
      results.push({ external_id: ext, status: "invalid_source_url" });
      continue;
    }
    const id = tx(() => {
      const { companies, executives, investors, deals, funding_rounds, regulatory_decisions, appointments } = it as Record<string, Record<string, unknown>[] | undefined>;
      const payload = { companies, executives, investors, deals, funding_rounds, regulatory_decisions, appointments };
      const itemId = run(
        `INSERT INTO extracted_items (external_id, origin, source_id, source_url, source_outlet, published_at, suggested_category, raw_title, ai_summary, significance_score, payload, ticks)
         VALUES (?, 'ingest', ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}')`,
        ext,
        it.source_id && get("SELECT 1 FROM sources WHERE id = ?", it.source_id) ? it.source_id : null,
        it.source_url,
        it.source_outlet ?? null,
        it.published_at ?? null,
        it.suggested_category ?? null,
        it.raw_title,
        it.ai_summary ?? null,
        it.significance_score ?? null,
        JSON.stringify(payload),
      ).lastId;
      const prov = `${it.source_outlet || "source"}: ${it.source_url}`;
      const fact = (kind: string, label: string, value: string) =>
        run("INSERT INTO facts (extracted_item_id, kind, label, value, status, provenance) VALUES (?, ?, ?, ?, 'unverified', ?)", itemId, kind, label, value, prov);
      for (const c of companies || []) {
        matchCompany(c as unknown as Co);
        fact("company", "Company", String(c.name));
      }
      for (const e of executives || []) fact("executive", "Executive", [e.name, e.title, e.company].filter(Boolean).join(", "));
      for (const i of investors || []) fact("investor", "Investor", String(i.name));
      for (const a of appointments || []) fact("appointment", "Appointment", [a.person, a.role, a.company].filter(Boolean).join(", "));
      for (const d of deals || []) {
        const target = String(d.target);
        const companyId = matchCompany({ name: target });
        run(
          "INSERT INTO deals (deal_type, acquirer, target, company_id, sector, value_text, value_usd_m, status, announced_on, verified, source, extracted_item_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'ingest', ?)",
          d.deal_type || "acquisition", d.acquirer ?? null, target, companyId, d.sector ?? null, d.value_text ?? null, d.value_usd_m ?? null, d.status || "announced", d.announced_on ?? null, itemId,
        );
        fact("deal", "Deal", `${d.acquirer ? d.acquirer + " → " : ""}${target}${d.value_text ? " · " + d.value_text : ""}`);
      }
      for (const r of funding_rounds || []) {
        const company = String(r.company);
        const companyId = matchCompany({ name: company });
        run(
          "INSERT INTO deals (deal_type, target, company_id, value_text, value_usd_m, round, investors, status, announced_on, verified, source, extracted_item_id) VALUES ('funding', ?, ?, ?, ?, ?, ?, 'announced', ?, 0, 'ingest', ?)",
          company, companyId, r.value_text ?? null, r.value_usd_m ?? null, r.round ?? null, r.investors ?? null, r.announced_on ?? null, itemId,
        );
        fact("funding", "Funding round", [company, r.round, r.value_text].filter(Boolean).join(" · "));
      }
      for (const r of regulatory_decisions || []) {
        run(
          "INSERT INTO regulatory_decisions (product, company, regulator, decision, decided_on, summary, verified, source, extracted_item_id) VALUES (?, ?, ?, ?, ?, ?, 0, 'ingest', ?)",
          r.product, r.company ?? null, r.regulator, r.decision || "pending", r.decided_on ?? null, r.summary ?? null, itemId,
        );
        fact("regulatory", "Regulatory decision", `${r.regulator}: ${r.product} (${r.decision || "pending"})`);
      }
      return itemId;
    });
    today++;
    results.push({ external_id: ext, id, status: "created" });
  }
  return NextResponse.json({ results });
}
