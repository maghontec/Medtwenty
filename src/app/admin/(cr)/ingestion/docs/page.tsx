import { requireStaff } from "@/lib/auth";
import { appUrl } from "@/lib/settings";
import { PageHead, Panel } from "../../ui";

export const metadata = { title: "Ingestion API" };

const ITEM = {
  items: [
    {
      external_id: "kimi-2026-10-07-nhse-001",
      source_id: 1,
      source_url: "https://www.england.nhs.uk/2026/10/example/",
      source_outlet: "NHS England",
      published_at: "2026-10-07T08:00:00Z",
      suggested_category: "nhs-healthcare-finance",
      raw_title: "NHS England confirms elective recovery funding for 2027/28",
      ai_summary: "Allocations for elective recovery are confirmed with a new tariff adjustment.",
      significance_score: 78,
      companies: [{ name: "Spire Healthcare", slug: "spire-healthcare", website: "spirehealthcare.com", country: "GB" }],
      executives: [{ name: "Jane Doe", title: "Chief Executive", company: "Example Trust" }],
      investors: [{ name: "Example Capital" }],
      deals: [{ deal_type: "acquisition", acquirer: "Example Group", target: "Example Clinics", value_text: "£120m", status: "announced" }],
      funding_rounds: [{ company: "Example AI", round: "Series A", value_text: "$20m", investors: "Example Capital" }],
      regulatory_decisions: [{ product: "Example device", regulator: "MHRA", decision: "approved" }],
      appointments: [{ person: "John Smith", role: "CFO", company: "Example Group" }],
    },
  ],
};

const DRAFT = {
  external_id: "claude-draft-0001",
  extracted_item_id: 42,
  headline: "NHS England confirms elective recovery funding for 2027/28",
  standfirst: "One-sentence standfirst.",
  body_markdown: "## What happened\n\n...\n\n## Why it matters\n\n...",
  why_it_matters: "One or two sentences.",
  suggested_topics: ["elective recovery", "tariff"],
  seo_title: "NHS confirms 2027/28 elective recovery funding",
  seo_description: "What the allocations mean for providers.",
};

const RUN = {
  external_id: "run-2026-10-07T06:00Z",
  status: "finished",
  started_at: "2026-10-07T06:00:00Z",
  finished_at: "2026-10-07T06:04:12Z",
  sources: [{ source_id: 1, items: 12, error: null }, { source_id: 4, items: 0, error: "HTTP 503" }],
};

function Block({ title, method, path, body, notes }: { title: string; method: string; path: string; body?: unknown; notes: string[] }) {
  return (
    <Panel title={title}>
      <p className="font-mono text-sm"><span className="rounded bg-charcoal px-1.5 py-0.5 text-white">{method}</span> {appUrl()}{path}</p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
      {body !== undefined && <pre className="mt-3 overflow-x-auto rounded bg-charcoal p-4 text-xs text-white">{JSON.stringify(body, null, 2)}</pre>}
    </Panel>
  );
}

export default async function Docs() {
  await requireStaff();
  return (
    <>
      <PageHead title="Ingestion API" sub="Endpoints for the external n8n pipeline. Lovable-side controls live under Sources and Site settings." />
      <div className="space-y-6">
        <Panel title="Authentication and rules">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Every request needs <code>Authorization: Bearer $INGEST_API_SECRET</code>. Without it the API returns 401.</li>
            <li>Bodies are validated; unknown fields are rejected with 400 and a list of problems.</li>
            <li>Idempotent: posting the same <code>external_id</code> again returns the existing record and creates nothing new.</li>
            <li>Rate limited to 60 requests a minute. Items are capped per day by <code>ingest_daily_cap</code>; while <code>ingest_paused</code> is on, items are refused with 423.</li>
            <li>Nothing posted here is ever published automatically.</li>
          </ul>
        </Panel>
        <Block title="1. Screened items" method="POST" path="/api/ingest/items" body={ITEM} notes={[
          "Up to 50 items per request. suggested_category must be one of: nhs-healthcare-finance, healthcare-companies, healthcare-technology, regulation-policy, investment-markets.",
          "Companies are matched by exact slug, then website, then name similarity above 0.9 in the same country; otherwise created as stubs.",
          "Every structured value is stored as an unverified fact with provenance. Deals and decisions are stored unverified until the story is published.",
          "The Shortlist shows the top 15 by significance_score each day.",
        ]} />
        <Block title="2. Write story → n8n draft webhook" method="POST" path=" (your N8N_DRAFT_URL)" notes={[
          "When the editor presses Write story, the server POSTs { extracted_item_id, article_id, title, source_url, source_outlet, summary, note, payload } with header X-N8N-Trigger-Secret.",
          "The webhook URL is server-side only and never reaches the browser.",
        ]} />
        <Block title="3. Claude draft" method="POST" path="/api/ingest/drafts" body={DRAFT} notes={[
          "Fills the draft created by Write story for that extracted_item_id. It stays a draft and the editor is notified in the Control Room and by email.",
        ]} />
        <Block title="4. Run reports" method="POST" path="/api/ingest/runs" body={RUN} notes={["Send once with status running at the start and again with finished or failed. Per-source counts update the Sources health view."]} />
        <Block title="5. Active sources" method="GET" path="/api/ingest/sources" notes={["Returns active sources with id, name, feed_url, source_type, category_slug and cadence. Paused sources, or all sources while ingestion is paused, are left out."]} />
      </div>
    </>
  );
}
