"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertStaff, type Staff } from "@/lib/auth";
import { all, get, run, tx } from "@/lib/db";
import { audit } from "@/lib/audit";
import { articleById, getOrCreateCurrentEdition } from "@/lib/content";
import { publishArticle, snapshot } from "@/lib/editorial";
import { slugify } from "@/lib/format";
import { createAnalystNoteIssue, createWeeklyIssueFromBriefing, sendIssue, sendTestIssue } from "@/lib/newsletters";
import { grantCompPlan, revokeCompPlan, syncPrices } from "@/lib/billing";
import { setSetting } from "@/lib/settings";
import { DEFAULT_SETTINGS, type SettingKey } from "@/lib/settings-defaults";
import { notifyEditor } from "@/lib/email";
import { appUrl } from "@/lib/settings";

const EDITORS = ["super_admin", "editor"] as const;
const actor = (s: Staff) => ({ id: s.id, email: s.email });
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const back = (fd: FormData, fallback: string) => {
  const b = str(fd, "back");
  return b.startsWith("/admin") ? b : fallback;
};
function withMsg(path: string, msg: string, key = "msg") {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(msg)}`;
}

function uniqueSlug(base: string, id?: number): string {
  let slug = slugify(base) || "untitled";
  let n = 2;
  while (get("SELECT 1 FROM articles WHERE slug = ? AND id != ?", slug, id ?? -1)) slug = `${slugify(base)}-${n++}`;
  return slug;
}

// ---------------- Shortlist ----------------

export async function addCandidateAction(fd: FormData) {
  const s = await assertStaff();
  const url = str(fd, "source_url");
  const title = str(fd, "title");
  if (!/^https?:\/\//.test(url) || !title) redirect(withMsg("/admin/shortlist", "A source URL and title are needed.", "err"));
  let outlet = str(fd, "source_outlet");
  if (!outlet) {
    try {
      outlet = new URL(url).hostname.replace(/^www\./, "");
    } catch {}
  }
  const id = run(
    "INSERT INTO extracted_items (origin, source_url, source_outlet, published_at, suggested_category, raw_title, note, ticks) VALUES ('manual', ?, ?, ?, ?, ?, ?, '{}')",
    url,
    outlet,
    new Date().toISOString(),
    str(fd, "category") || null,
    title,
    str(fd, "note") || null,
  ).lastId;
  audit(actor(s), "add_candidate", "extracted_item", id, null, { url, title });
  redirect(withMsg("/admin/shortlist", "Candidate added."));
}

export async function tickCandidateAction(fd: FormData) {
  await assertStaff();
  const id = Number(fd.get("id"));
  const key = str(fd, "tick");
  const row = get<{ ticks: string }>("SELECT ticks FROM extracted_items WHERE id = ?", id);
  if (!row) return;
  const ticks = JSON.parse(row.ticks || "{}") as Record<string, boolean>;
  ticks[key] = !ticks[key];
  run("UPDATE extracted_items SET ticks = ? WHERE id = ?", JSON.stringify(ticks), id);
  revalidatePath("/admin/shortlist");
}

export async function candidateDecisionAction(fd: FormData) {
  const s = await assertStaff();
  const id = Number(fd.get("id"));
  const op = str(fd, "op");
  const c = get<{ id: number; raw_title: string; source_url: string; source_outlet: string | null; suggested_category: string | null; ticks: string; ai_summary: string | null; note: string | null; payload: string | null; article_id: number | null }>(
    "SELECT * FROM extracted_items WHERE id = ?",
    id,
  );
  if (!c) redirect("/admin/shortlist");
  if (op === "dismiss") {
    run("UPDATE extracted_items SET status = 'dismissed', dismiss_reason = ? WHERE id = ?", str(fd, "reason") || null, id);
    audit(actor(s), "dismiss_candidate", "extracted_item", id);
    redirect(back(fd, "/admin/shortlist"));
  }
  if (op === "analysis") {
    run("UPDATE extracted_items SET status = 'saved_analysis' WHERE id = ?", id);
    audit(actor(s), "save_for_analysis", "extracted_item", id);
    redirect(withMsg(back(fd, "/admin/shortlist"), "Saved for monthly analysis."));
  }
  if (op === "restore") {
    run("UPDATE extracted_items SET status = 'new', dismiss_reason = NULL WHERE id = ?", id);
    redirect(back(fd, "/admin/shortlist"));
  }
  if (op === "write" || op === "start_analysis") {
    const ticks = JSON.parse(c.ticks || "{}") as Record<string, boolean>;
    if (op === "write" && !ticks.source) redirect(withMsg("/admin/shortlist", "Tick \"Reliable primary source\" before writing.", "err"));
    if (c.article_id) redirect(`/admin/articles/${c.article_id}`);
    const cat = c.suggested_category ? get<{ id: number }>("SELECT id FROM categories WHERE slug = ? AND is_active = 1", c.suggested_category) : undefined;
    const type = op === "start_analysis" ? "analysis" : "story";
    const articleId = tx(() => {
      const aid = run(
        `INSERT INTO articles (slug, headline, standfirst, body, source_outlet, source_url, content_type, category_id, is_premium, status, candidate_id, created_by, author_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
        uniqueSlug(c.raw_title),
        c.raw_title,
        c.ai_summary || "",
        type === "story" ? "## What happened\n\n\n## Why it matters\n\n" : "## Summary\n\n\n## Findings\n\n\n## Method\n\n",
        c.source_outlet,
        c.source_url,
        type,
        cat?.id ?? null,
        type === "analysis" ? 1 : 0,
        c.id,
        s.id,
        s.name || null,
      ).lastId;
      run("UPDATE extracted_items SET status = 'writing', article_id = ? WHERE id = ?", aid, c.id);
      // Facts that arrived with the item become this draft's unverified facts.
      run("UPDATE facts SET article_id = ? WHERE extracted_item_id = ? AND article_id IS NULL", aid, c.id);
      run("UPDATE deals SET article_id = ? WHERE extracted_item_id = ? AND article_id IS NULL", aid, c.id);
      run("UPDATE regulatory_decisions SET article_id = ? WHERE extracted_item_id = ? AND article_id IS NULL", aid, c.id);
      return aid;
    });
    audit(actor(s), "write_story", "article", articleId, null, { candidate: c.id, type });
    // Ask the n8n pipeline for a Claude draft (server-side only).
    if (process.env.N8N_DRAFT_URL && op === "write") {
      try {
        await fetch(process.env.N8N_DRAFT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-N8N-Trigger-Secret": process.env.N8N_TRIGGER_SECRET || "" },
          body: JSON.stringify({ extracted_item_id: c.id, article_id: articleId, title: c.raw_title, source_url: c.source_url, source_outlet: c.source_outlet, summary: c.ai_summary, note: c.note, payload: c.payload ? JSON.parse(c.payload) : null }),
          signal: AbortSignal.timeout(8000),
        });
      } catch {
        /* the draft can still be written by hand */
      }
    }
    redirect(`/admin/articles/${articleId}`);
  }
  redirect("/admin/shortlist");
}

// ---------------- Articles ----------------

export async function newArticleAction(fd: FormData) {
  const s = await assertStaff();
  const type = ["story", "briefing", "analysis"].includes(str(fd, "type")) ? str(fd, "type") : "story";
  const headline = type === "analysis" ? "Untitled analysis" : "Untitled story";
  const id = run(
    "INSERT INTO articles (slug, headline, body, content_type, is_premium, status, created_by, author_name) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)",
    uniqueSlug(`${headline}-${Date.now()}`),
    headline,
    type === "story" ? "## What happened\n\n\n## Why it matters\n\n" : "",
    type,
    type === "analysis" ? 1 : 0,
    s.id,
    s.name || null,
  ).lastId;
  audit(actor(s), "create", "article", id, null, { type });
  redirect(`/admin/articles/${id}`);
}

export type SaveResult = { ok: boolean; at?: string; error?: string; slug?: string };

const ARTICLE_FIELDS = [
  "headline",
  "standfirst",
  "body",
  "why_it_matters",
  "source_outlet",
  "source_url",
  "content_type",
  "category_id",
  "topics",
  "is_premium",
  "is_editors_pick",
  "seo_title",
  "seo_description",
  "slug",
  "editorial_minutes",
  "hero_image_url",
  "hero_alt",
  "author_name",
  "send_daily",
] as const;

/** Autosave and manual save from the article editor. */
export async function saveArticleAction(id: number, data: Record<string, string | number | boolean | null>, makeVersion = false): Promise<SaveResult> {
  const s = await assertStaff();
  const before = articleById(id);
  if (!before) return { ok: false, error: "Not found" };
  if (["published", "retracted"].includes(before.status) && !s.roles.some((r) => (EDITORS as readonly string[]).includes(r))) return { ok: false, error: "Only editors can change published pieces." };
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const k of ARTICLE_FIELDS) {
    if (!(k in data)) continue;
    let v = data[k];
    if (k === "slug") v = uniqueSlug(String(v || before.headline), id);
    if (k === "category_id") {
      v = v ? Number(v) : null;
      if (v && !get("SELECT 1 FROM categories WHERE id = ? AND is_active = 1", v)) continue;
    }
    if (k === "content_type" && !["story", "briefing", "analysis"].includes(String(v))) continue;
    if (k === "editorial_minutes") v = v === "" || v == null ? null : Math.max(0, Math.round(Number(v)));
    if (k === "hero_image_url" && v && !/^(https:\/\/|\/images\/)/.test(String(v))) continue;
    if (k === "source_url" && v && !/^https?:\/\//.test(String(v))) continue;
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (!sets.length) return { ok: true, at: new Date().toISOString() };
  const words = String(data.body ?? before.body).split(/\s+/).filter(Boolean).length;
  sets.push("read_minutes = ?", "updated_at = ?");
  vals.push(Math.max(1, Math.round(words / 220)), new Date().toISOString());
  run(`UPDATE articles SET ${sets.join(", ")} WHERE id = ?`, ...vals, id);
  if (makeVersion) {
    snapshot(id, s.id);
    audit(actor(s), "save", "article", id, pick(before), pick(articleById(id)!));
  }
  return { ok: true, at: new Date().toISOString(), slug: articleById(id)?.slug };
}

function pick(a: object) {
  const o = a as Record<string, unknown>;
  return { headline: o.headline, status: o.status, is_premium: o.is_premium, category_id: o.category_id, slug: o.slug, content_type: o.content_type };
}

export async function articleStatusAction(fd: FormData) {
  const s = await assertStaff();
  const id = Number(fd.get("id"));
  const op = str(fd, "op");
  const note = str(fd, "note");
  const to = back(fd, `/admin/articles/${id}`);
  const a = articleById(id);
  if (!a) redirect("/admin/pipeline");
  const isEditor = s.roles.some((r) => (EDITORS as readonly string[]).includes(r));
  const set = (status: string, extra = "", ...p: unknown[]) =>
    run(`UPDATE articles SET status = ?, updated_at = ?${extra} WHERE id = ?`, status, new Date().toISOString(), ...p, id);

  try {
    switch (op) {
      case "review":
        set("review");
        break;
      case "approve":
        if (!isEditor) throw new Error("Only editors can approve.");
        set("approved");
        break;
      case "draft":
        set("draft", ", review_note = ?", note || null);
        break;
      case "reject":
        set("rejected", ", review_note = ?", note || null);
        break;
      case "publish":
        if (!isEditor) throw new Error("Only editors and super admins can publish.");
        publishArticle(id, actor(s), fd.has("send_daily_present") ? fd.get("send_daily") === "1" : undefined);
        audit(actor(s), "status", "article", id, { status: a.status }, { status: "published" });
        redirect(withMsg(to, "Published."));
      case "schedule": {
        if (!isEditor) throw new Error("Only editors can schedule.");
        const when = str(fd, "when");
        const d = new Date(when);
        if (!when || isNaN(d.getTime()) || d.getTime() < Date.now()) throw new Error("Choose a future date and time.");
        set("scheduled", ", scheduled_for = ?", d.toISOString());
        break;
      }
      case "retract":
        if (!isEditor) throw new Error("Only editors can retract.");
        if (!note) throw new Error("A retraction needs a note explaining why.");
        set("retracted");
        run("INSERT INTO corrections (article_id, note, kind, status, created_by) VALUES (?, ?, 'retraction', 'published', ?)", id, note, s.id);
        break;
      case "unpublish":
        if (!isEditor) throw new Error("Only editors can unpublish.");
        set("approved");
        break;
      default:
        throw new Error("Unknown action");
    }
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    redirect(withMsg(to, (e as Error).message, "err"));
  }
  audit(actor(s), "status", "article", id, { status: a.status }, { status: op, note: note || undefined });
  redirect(withMsg(to, "Updated."));
}

export async function restoreVersionAction(fd: FormData) {
  const s = await assertStaff(["super_admin", "editor"]);
  const vid = Number(fd.get("version_id"));
  const v = get<{ article_id: number; snapshot: string }>("SELECT article_id, snapshot FROM article_versions WHERE id = ?", vid);
  if (!v) redirect("/admin/pipeline");
  const snap = JSON.parse(v.snapshot) as Record<string, unknown>;
  snapshot(v.article_id, s.id);
  run(
    "UPDATE articles SET headline = ?, standfirst = ?, body = ?, why_it_matters = ?, source_outlet = ?, source_url = ?, seo_title = ?, seo_description = ?, hero_image_url = ?, hero_alt = ?, updated_at = ? WHERE id = ?",
    snap.headline, snap.standfirst, snap.body, snap.why_it_matters, snap.source_outlet, snap.source_url, snap.seo_title, snap.seo_description, snap.hero_image_url, snap.hero_alt, new Date().toISOString(), v.article_id,
  );
  audit(actor(s), "restore_version", "article", v.article_id, null, { version: vid });
  redirect(withMsg(`/admin/articles/${v.article_id}`, "Version restored."));
}

// ---------------- Facts and entities ----------------

export async function factAction(fd: FormData) {
  const s = await assertStaff();
  const op = str(fd, "op");
  const articleId = Number(fd.get("article_id"));
  const to = `/admin/articles/${articleId}#facts`;
  if (op === "add") {
    const label = str(fd, "label");
    const value = str(fd, "value");
    if (label && value) run("INSERT INTO facts (article_id, kind, label, value, provenance) VALUES (?, ?, ?, ?, ?)", articleId, str(fd, "kind") || "figure", label, value, str(fd, "provenance") || "editor");
  } else {
    const id = Number(fd.get("id"));
    if (op === "verify") run("UPDATE facts SET status = 'verified', verified_by = ?, verified_at = ? WHERE id = ? AND article_id = ?", s.id, new Date().toISOString(), id, articleId);
    if (op === "reject") run("UPDATE facts SET status = 'rejected' WHERE id = ? AND article_id = ?", id, articleId);
    if (op === "edit") run("UPDATE facts SET value = ?, status = 'unverified' WHERE id = ? AND article_id = ?", str(fd, "value"), id, articleId);
    if (op === "verify_all") run("UPDATE facts SET status = 'verified', verified_by = ?, verified_at = ? WHERE article_id = ? AND status = 'unverified'", s.id, new Date().toISOString(), articleId);
    audit(actor(s), `fact_${op}`, "fact", id || articleId);
  }
  redirect(to);
}

export async function entityLinkAction(fd: FormData) {
  const s = await assertStaff();
  const articleId = Number(fd.get("article_id"));
  const type = str(fd, "entity_type") as "company" | "deal" | "regulatory";
  const op = str(fd, "op");
  if (op === "unlink") {
    run("DELETE FROM article_entities WHERE article_id = ? AND entity_type = ? AND entity_id = ?", articleId, type, Number(fd.get("entity_id")));
  } else if (op === "create_company") {
    const name = str(fd, "name");
    if (name) {
      let slug = slugify(name);
      let n = 2;
      while (get("SELECT 1 FROM companies WHERE slug = ?", slug)) slug = `${slugify(name)}-${n++}`;
      const cid = run("INSERT INTO companies (slug, name, is_stub, source) VALUES (?, ?, 1, 'manual')", slug, name).lastId;
      run("INSERT OR IGNORE INTO article_entities (article_id, entity_type, entity_id) VALUES (?, 'company', ?)", articleId, cid);
    }
  } else if (op === "create_deal") {
    const target = str(fd, "target");
    if (target) {
      const did = run(
        "INSERT INTO deals (deal_type, acquirer, target, sector, value_text, round, status, announced_on, verified, article_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)",
        str(fd, "deal_type") || "acquisition", str(fd, "acquirer") || null, target, str(fd, "sector") || null, str(fd, "value_text") || null, str(fd, "round") || null, str(fd, "status") || "announced", new Date().toISOString().slice(0, 10), articleId,
      ).lastId;
      run("INSERT OR IGNORE INTO article_entities (article_id, entity_type, entity_id) VALUES (?, 'deal', ?)", articleId, did);
    }
  } else if (op === "create_regulatory") {
    const product = str(fd, "product");
    if (product) {
      const rid = run(
        "INSERT INTO regulatory_decisions (product, company, regulator, decision, decided_on, summary, verified, article_id) VALUES (?, ?, ?, ?, ?, ?, 0, ?)",
        product, str(fd, "company") || null, str(fd, "regulator") || "MHRA", str(fd, "decision") || "approved", new Date().toISOString().slice(0, 10), str(fd, "summary") || null, articleId,
      ).lastId;
      run("INSERT OR IGNORE INTO article_entities (article_id, entity_type, entity_id) VALUES (?, 'regulatory', ?)", articleId, rid);
    }
  } else {
    const eid = Number(fd.get("entity_id"));
    if (eid) run("INSERT OR IGNORE INTO article_entities (article_id, entity_type, entity_id) VALUES (?, ?, ?)", articleId, type, eid);
  }
  audit(actor(s), `entity_${op || "link"}`, "article", articleId, null, { type });
  redirect(`/admin/articles/${articleId}#entities`);
}

// ---------------- Weekly briefing ----------------

export async function publishBriefingAction(fd: FormData) {
  const s = await assertStaff(["super_admin", "editor"]);
  const ids = fd.getAll("article_id").map(Number).filter(Boolean).slice(0, 5);
  const overview = str(fd, "overview");
  if (!ids.length) redirect(withMsg("/admin/briefing", "Choose at least one piece.", "err"));
  const words = overview.split(/\s+/).filter(Boolean).length;
  if (words < 50) redirect(withMsg("/admin/briefing", `Write an overview (200-400 words suggested; you have ${words}).`, "err"));
  const ed = getOrCreateCurrentEdition();
  const existing = get<{ id: number }>("SELECT id FROM articles WHERE content_type = 'briefing' AND edition_id = ? AND status = 'published'", ed.id);
  if (existing) redirect(withMsg("/admin/briefing", "This week's briefing is already published.", "err"));
  const standfirst = str(fd, "standfirst") || (ids.length < 5 ? `A shorter week: ${ids.length} developments that matter.` : "The five developments that mattered this week.");
  const briefingId = tx(() => {
    const id = run(
      `INSERT INTO articles (slug, headline, standfirst, body, content_type, category_id, is_premium, status, created_by, author_name, editorial_minutes, send_daily)
       VALUES (?, ?, ?, ?, 'briefing', (SELECT id FROM categories WHERE is_active = 1 ORDER BY sort_order LIMIT 1), 0, 'draft', ?, ?, ?, 0)`,
      uniqueSlug(`the-medtwenty-weekly-${ed.week_label}`),
      `The MedTwenty Weekly: ${ed.week_label}`,
      standfirst,
      `## Overview\n\n${overview}`,
      s.id,
      s.name || null,
      Number(fd.get("editorial_minutes")) || null,
    ).lastId;
    run("UPDATE articles SET edition_rank = NULL WHERE edition_id = ? AND edition_rank IS NOT NULL", ed.id);
    ids.forEach((aid, i) => {
      run("INSERT INTO briefing_items (briefing_id, article_id, rank) VALUES (?, ?, ?)", id, aid, i + 1);
      run("UPDATE articles SET edition_rank = ? WHERE id = ?", i + 1, aid);
    });
    return id;
  });
  publishArticle(briefingId, actor(s), false);
  const issueId = createWeeklyIssueFromBriefing(briefingId);
  audit(actor(s), "publish_briefing", "article", briefingId, null, { items: ids, issue: issueId });
  redirect(withMsg(`/admin/newsletters/${issueId}`, "Briefing published. Review this draft issue of The MedTwenty Weekly, then send or schedule it."));
}

// ---------------- Newsletters ----------------

export async function issueAction(fd: FormData) {
  const s = await assertStaff(["super_admin", "editor"]);
  const id = Number(fd.get("id"));
  const op = str(fd, "op");
  const to = `/admin/newsletters/${id}`;
  if (op === "save" || op === "schedule" || op === "send" || op === "test") {
    const blocks = {
      intro: str(fd, "intro") || undefined,
      overview: str(fd, "overview") || undefined,
      stories: parseStories(str(fd, "stories")),
      signoff: str(fd, "signoff") || undefined,
    };
    run("UPDATE newsletter_issues SET subject = ?, preheader = ?, blocks = ? WHERE id = ? AND status IN ('draft','scheduled')", str(fd, "subject"), str(fd, "preheader"), JSON.stringify(blocks), id);
  }
  if (op === "test") {
    await sendTestIssue(id, s.email);
    redirect(withMsg(to, `Test sent to ${s.email}.`));
  }
  if (op === "schedule") {
    const d = new Date(str(fd, "when"));
    if (isNaN(d.getTime()) || d.getTime() < Date.now()) redirect(withMsg(to, "Choose a future time.", "err"));
    run("UPDATE newsletter_issues SET status = 'scheduled', scheduled_for = ? WHERE id = ?", d.toISOString(), id);
    audit(actor(s), "schedule_issue", "newsletter_issue", id, null, { when: d.toISOString() });
    redirect(withMsg(to, "Scheduled."));
  }
  if (op === "send") {
    const n = await sendIssue(id);
    audit(actor(s), "send_issue", "newsletter_issue", id, null, { recipients: n });
    redirect(withMsg(to, `Sent to ${n} subscribers.`));
  }
  if (op === "cancel") {
    run("UPDATE newsletter_issues SET status = 'canceled' WHERE id = ? AND status IN ('draft','scheduled')", id);
    audit(actor(s), "cancel_issue", "newsletter_issue", id);
    redirect(withMsg(to, "Cancelled."));
  }
  if (op === "unschedule") {
    run("UPDATE newsletter_issues SET status = 'draft', scheduled_for = NULL WHERE id = ? AND status = 'scheduled'", id);
    redirect(withMsg(to, "Moved back to draft."));
  }
  redirect(withMsg(to, "Saved."));
}

function parseStories(raw: string) {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function analystNoteAction(fd: FormData) {
  const s = await assertStaff(["super_admin", "editor"]);
  const id = createAnalystNoteIssue(Number(fd.get("article_id")));
  audit(actor(s), "create_analyst_note", "newsletter_issue", id);
  redirect(`/admin/newsletters/${id}`);
}

export async function subscriberAction(fd: FormData) {
  const s = await assertStaff(["super_admin", "editor"]);
  const id = Number(fd.get("id"));
  const op = str(fd, "op");
  const row = get<{ email: string }>("SELECT email FROM newsletter_subscribers WHERE id = ?", id);
  if (op === "gdpr_delete" && row) {
    run("DELETE FROM newsletter_subscribers WHERE email = ?", row.email);
    run("DELETE FROM email_outbox WHERE to_email = ?", row.email);
    audit(actor(s), "gdpr_delete_subscriber", "newsletter_subscriber", row.email);
  }
  if (op === "unsubscribe") run("UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_reason = 'admin' WHERE id = ?", id);
  redirect(back(fd, "/admin/newsletters?tab=subscribers"));
}

// ---------------- Data: deals, decisions, companies, corrections ----------------

export async function dealAction(fd: FormData) {
  const s = await assertStaff();
  const op = str(fd, "op");
  const id = Number(fd.get("id"));
  if (op === "delete") {
    run("DELETE FROM deals WHERE id = ?", id);
  } else if (op === "toggle_verified") {
    run("UPDATE deals SET verified = 1 - verified WHERE id = ?", id);
  } else {
    const vals = [str(fd, "deal_type") || "acquisition", str(fd, "acquirer") || null, str(fd, "target"), str(fd, "sector") || null, str(fd, "value_text") || null, Number(fd.get("value_usd_m")) || null, str(fd, "round") || null, str(fd, "investors") || null, str(fd, "status") || "announced", str(fd, "announced_on") || null];
    if (!vals[2]) redirect(withMsg("/admin/deals", "Target is required.", "err"));
    if (id) run("UPDATE deals SET deal_type=?, acquirer=?, target=?, sector=?, value_text=?, value_usd_m=?, round=?, investors=?, status=?, announced_on=? WHERE id = ?", ...vals, id);
    else run("INSERT INTO deals (deal_type, acquirer, target, sector, value_text, value_usd_m, round, investors, status, announced_on, verified) VALUES (?,?,?,?,?,?,?,?,?,?,0)", ...vals);
  }
  audit(actor(s), `deal_${op || "save"}`, "deal", id || null);
  redirect(withMsg("/admin/deals", "Saved."));
}

export async function decisionAction(fd: FormData) {
  const s = await assertStaff();
  const op = str(fd, "op");
  const id = Number(fd.get("id"));
  if (op === "delete") run("DELETE FROM regulatory_decisions WHERE id = ?", id);
  else if (op === "toggle_verified") run("UPDATE regulatory_decisions SET verified = 1 - verified WHERE id = ?", id);
  else {
    if (!str(fd, "product")) redirect(withMsg("/admin/regulatory", "Product or subject is required.", "err"));
    run(
      "INSERT INTO regulatory_decisions (product, company, regulator, decision, decided_on, summary, verified) VALUES (?, ?, ?, ?, ?, ?, 0)",
      str(fd, "product"), str(fd, "company") || null, str(fd, "regulator") || "MHRA", str(fd, "decision") || "approved", str(fd, "decided_on") || null, str(fd, "summary") || null,
    );
  }
  audit(actor(s), `regulatory_${op || "create"}`, "regulatory_decision", id || null);
  redirect(withMsg("/admin/regulatory", "Saved."));
}

export async function companyAction(fd: FormData) {
  const s = await assertStaff();
  const id = Number(fd.get("id"));
  const op = str(fd, "op");
  if (op === "create") {
    const name = str(fd, "name");
    if (!name) redirect("/admin/companies");
    let slug = slugify(name);
    let n = 2;
    while (get("SELECT 1 FROM companies WHERE slug = ?", slug)) slug = `${slugify(name)}-${n++}`;
    run("INSERT INTO companies (slug, name, sector, country, website, description, is_stub) VALUES (?, ?, ?, ?, ?, ?, 0)", slug, name, str(fd, "sector") || null, str(fd, "country") || "GB", str(fd, "website") || null, str(fd, "description") || null);
  } else if (op === "update") {
    run("UPDATE companies SET name = ?, sector = ?, country = ?, website = ?, description = ?, is_stub = ? WHERE id = ?", str(fd, "name"), str(fd, "sector") || null, str(fd, "country") || null, str(fd, "website") || null, str(fd, "description") || null, fd.get("is_stub") ? 1 : 0, id);
  }
  audit(actor(s), `company_${op}`, "company", id || null);
  redirect(withMsg("/admin/companies", "Saved."));
}

export async function correctionAction(fd: FormData) {
  const s = await assertStaff(["super_admin", "editor"]);
  const op = str(fd, "op");
  if (op === "create") {
    const articleId = Number(fd.get("article_id"));
    const note = str(fd, "note");
    if (articleId && note) run("INSERT INTO corrections (article_id, note, kind, status, created_by) VALUES (?, ?, ?, 'pending', ?)", articleId, note, str(fd, "kind") || "correction", s.id);
  } else if (op === "publish") {
    run("UPDATE corrections SET status = 'published' WHERE id = ?", Number(fd.get("id")));
  } else if (op === "delete") {
    run("DELETE FROM corrections WHERE id = ? AND status = 'pending'", Number(fd.get("id")));
  }
  audit(actor(s), `correction_${op}`, "correction", Number(fd.get("id")) || null);
  redirect(back(fd, "/admin/pipeline?tab=corrections"));
}

// ---------------- Members ----------------

export async function compGrantAction(fd: FormData) {
  const s = await assertStaff(["super_admin"]);
  const email = str(fd, "email").toLowerCase();
  if (str(fd, "op") === "revoke") revokeCompPlan(email, actor(s));
  else {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect(withMsg("/admin/members", "Enter a valid email.", "err"));
    const until = str(fd, "until");
    grantCompPlan(email, str(fd, "plan_code") || "premium", until ? new Date(until + "T23:59:59Z").toISOString() : null, actor(s));
  }
  redirect(withMsg(back(fd, "/admin/members"), "Saved."));
}

export async function roleAction(fd: FormData) {
  const s = await assertStaff(["super_admin"]);
  const email = str(fd, "email").toLowerCase();
  const role = str(fd, "role");
  if (!["editor", "contributor", "super_admin"].includes(role)) redirect("/admin/members");
  const u = get<{ id: number }>("SELECT id FROM users WHERE email = ?", email);
  if (!u) redirect(withMsg("/admin/members?tab=staff", "That person needs an account first.", "err"));
  if (str(fd, "op") === "remove") {
    if (u.id === s.id && role === "super_admin") redirect(withMsg("/admin/members?tab=staff", "You can't remove your own super admin role.", "err"));
    run("DELETE FROM user_roles WHERE user_id = ? AND role = ?", u.id, role);
  } else run("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, ?)", u.id, role);
  audit(actor(s), `role_${str(fd, "op") || "add"}`, "user", u.id, null, { role });
  redirect(withMsg("/admin/members?tab=staff", "Saved."));
}

// ---------------- Settings ----------------

export async function settingsAction(fd: FormData) {
  const s = await assertStaff(["super_admin"]);
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const current = Object.fromEntries(all<{ key: string; value: string }>("SELECT key, value FROM site_settings").map((r) => [r.key, r.value]));
  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
    const def = DEFAULT_SETTINGS[key];
    if (!fd.has(`present_${key}`)) continue;
    let v: string;
    if (typeof def === "boolean") v = fd.get(key) ? "true" : "false";
    else v = str(fd, key);
    if (current[key] !== v) {
      before[key] = current[key];
      after[key] = v;
      setSetting(key, v);
    }
  }
  if (Object.keys(after).length) audit(actor(s), "update_settings", "site_settings", null, before, after);
  revalidatePath("/", "layout");
  redirect(withMsg(back(fd, "/admin/settings"), Object.keys(after).length ? "Settings saved." : "No changes."));
}

export async function legalAction(fd: FormData) {
  const s = await assertStaff(["super_admin"]);
  const slug = str(fd, "slug");
  const op = str(fd, "op");
  if (op === "reviewed") run("UPDATE legal_pages SET reviewed_at = ? WHERE slug = ?", new Date().toISOString(), slug);
  else if (op === "unreview") run("UPDATE legal_pages SET reviewed_at = NULL WHERE slug = ?", slug);
  else run("UPDATE legal_pages SET title = ?, body = ?, reviewed_at = NULL, updated_at = ? WHERE slug = ?", str(fd, "title"), String(fd.get("body") || ""), new Date().toISOString(), slug);
  audit(actor(s), `legal_${op || "save"}`, "legal_page", slug);
  redirect(withMsg("/admin/settings?tab=legal", "Saved."));
}

export async function redirectAction(fd: FormData) {
  const s = await assertStaff(["super_admin"]);
  const from = str(fd, "from_path");
  if (str(fd, "op") === "delete") run("DELETE FROM redirects WHERE from_path = ?", from);
  else {
    const to = str(fd, "to_path");
    if (!from.startsWith("/") || !to.startsWith("/")) redirect(withMsg("/admin/settings?tab=redirects", "Paths must start with /.", "err"));
    run("INSERT OR REPLACE INTO redirects (from_path, to_path, note) VALUES (?, ?, ?)", from, to, str(fd, "note") || null);
  }
  audit(actor(s), "redirect", "redirects", from);
  redirect(withMsg("/admin/settings?tab=redirects", "Saved."));
}

// ---------------- Sources and ingestion ----------------

export async function sourceAction(fd: FormData) {
  const s = await assertStaff(["super_admin", "editor"]);
  const id = Number(fd.get("id"));
  const op = str(fd, "op");
  if (op === "toggle") run("UPDATE sources SET is_active = 1 - is_active WHERE id = ?", id);
  if (op === "cadence") run("UPDATE sources SET cadence = ? WHERE id = ?", str(fd, "cadence"), id);
  if (op === "category") run("UPDATE sources SET category_slug = ? WHERE id = ?", str(fd, "category_slug"), id);
  if (op === "retry") run("UPDATE sources SET last_error = NULL, last_checked_at = NULL WHERE id = ?", id);
  if (op === "create") {
    run(
      "INSERT INTO sources (name, feed_url, source_type, category_slug, cadence, is_active, needs_verification) VALUES (?, ?, ?, ?, ?, 1, ?)",
      str(fd, "name"), str(fd, "feed_url") || null, str(fd, "source_type") || "rss", str(fd, "category_slug") || null, str(fd, "cadence") || "daily", fd.get("needs_verification") ? 1 : 0,
    );
  }
  if (op === "verified") run("UPDATE sources SET needs_verification = 0 WHERE id = ?", id);
  audit(actor(s), `source_${op}`, "source", id || null);
  redirect(withMsg("/admin/sources", "Saved."));
}

// ---------------- Launch ----------------

export async function launchCheckAction(fd: FormData) {
  const s = await assertStaff(["super_admin"]);
  const key = str(fd, "key");
  const done = get("SELECT done_at FROM launch_checks WHERE key = ? AND done_at IS NOT NULL", key);
  run("INSERT OR REPLACE INTO launch_checks (key, done_at) VALUES (?, ?)", key, done ? null : new Date().toISOString());
  audit(actor(s), "launch_check", "launch_checks", key, { done: !!done }, { done: !done });
  redirect("/admin/launch");
}

export async function removeSampleDataAction(fd: FormData) {
  const s = await assertStaff(["super_admin"]);
  if (str(fd, "confirm") !== "REMOVE SAMPLE DATA") redirect(withMsg("/admin/launch", "Type REMOVE SAMPLE DATA to confirm.", "err"));
  const counts = tx(() => {
    const ids = all<{ id: number }>("SELECT id FROM articles WHERE source = 'seed'").map((r) => r.id);
    for (const id of ids) {
      run("UPDATE extracted_items SET article_id = NULL WHERE article_id = ?", id);
      run("UPDATE newsletter_issues SET article_id = NULL WHERE article_id = ?", id);
    }
    const a = run("DELETE FROM articles WHERE source = 'seed'").changes;
    const d = run("DELETE FROM deals WHERE source = 'seed'").changes;
    const r = run("DELETE FROM regulatory_decisions WHERE source = 'seed'").changes;
    run("UPDATE deals SET company_id = NULL WHERE company_id IN (SELECT id FROM companies WHERE source = 'seed')");
    run("UPDATE regulatory_decisions SET company_id = NULL WHERE company_id IN (SELECT id FROM companies WHERE source = 'seed')");
    run("DELETE FROM article_entities WHERE entity_type = 'company' AND entity_id IN (SELECT id FROM companies WHERE source = 'seed')");
    const c = run("DELETE FROM companies WHERE source = 'seed'").changes;
    run("DELETE FROM editions WHERE is_current = 0 AND id NOT IN (SELECT DISTINCT edition_id FROM articles WHERE edition_id IS NOT NULL)");
    return { articles: a, deals: d, decisions: r, companies: c };
  });
  audit(actor(s), "remove_sample_data", "seed", null, counts, null);
  redirect(withMsg("/admin/launch", `Sample data removed: ${counts.articles} articles, ${counts.deals} deals, ${counts.decisions} decisions, ${counts.companies} companies.`));
}

export async function syncPricesAction() {
  const s = await assertStaff(["super_admin"]);
  try {
    const ids = await syncPrices();
    audit(actor(s), "sync_stripe_prices", "plans", null, null, ids);
    redirect(withMsg("/admin/launch", `Stripe prices ready: ${Object.values(ids).join(", ")}`));
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    redirect(withMsg("/admin/launch", (e as Error).message, "err"));
  }
}

export async function launchAction(fd: FormData) {
  const s = await assertStaff(["super_admin"]);
  if (str(fd, "confirm") !== "LAUNCH") redirect(withMsg("/admin/launch", "Type LAUNCH to confirm.", "err"));
  setSetting("launch_mode", false);
  setSetting("launch_date", new Date().toISOString().slice(0, 10));
  audit(actor(s), "launch", "site_settings", null, { launch_mode: true }, { launch_mode: false });
  await notifyEditor("MedTwenty is live", "Launch mode is off. Remember to switch off the rebrand notice in about three months.", `${appUrl()}/admin/settings`);
  redirect(withMsg("/admin/launch", "MedTwenty is live."));
}
