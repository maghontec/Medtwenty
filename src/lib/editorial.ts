import "server-only";
import { all, get, run, tx } from "./db";
import { articleById, getOrCreateCurrentEdition, type Article } from "./content";
import { createDailyStoryIssue, sendIssue } from "./newsletters";
import { audit } from "./audit";

export type PublishCheck = { label: string; ok: boolean };

export function publishChecklist(a: Article): PublishCheck[] {
  const facts = all<{ status: string }>("SELECT status FROM facts WHERE article_id = ?", a.id);
  const unverified = facts.filter((f) => f.status === "unverified").length;
  const checks: PublishCheck[] = [
    { label: "Headline", ok: a.headline.trim().length > 0 },
    { label: "Body", ok: a.body.trim().length > 0 },
    { label: "Category", ok: !!a.category_id },
    { label: unverified ? `All facts verified (${unverified} unverified)` : "All facts verified", ok: unverified === 0 },
  ];
  if (a.content_type === "story") {
    checks.push({ label: "\"Why it matters\" section", ok: !!a.why_it_matters?.trim() });
    checks.push({ label: "Source line (outlet and URL)", ok: !!a.source_outlet?.trim() && !!a.source_url?.trim() });
  }
  if (a.hero_image_url) checks.push({ label: "Hero image alt text", ok: !!a.hero_alt?.trim() });
  return checks;
}

export function snapshot(articleId: number, userId: number | null) {
  const a = get("SELECT * FROM articles WHERE id = ?", articleId);
  if (a) run("INSERT INTO article_versions (article_id, snapshot, created_by) VALUES (?, ?, ?)", articleId, JSON.stringify(a), userId);
}

/** Publish an article. Throws with a readable message if the checklist fails. */
export function publishArticle(articleId: number, actor: { id: number; email: string } | null, sendDaily?: boolean): Article {
  const a = articleById(articleId);
  if (!a) throw new Error("Article not found");
  const failing = publishChecklist(a).filter((c) => !c.ok);
  if (failing.length) throw new Error("Cannot publish yet: " + failing.map((c) => c.label).join("; "));

  tx(() => {
    const ed = getOrCreateCurrentEdition();
    const now = new Date().toISOString();
    run(
      "UPDATE articles SET status = 'published', published_at = ?, scheduled_for = NULL, edition_id = ?, send_daily = ?, updated_at = ? WHERE id = ?",
      now,
      ed.id,
      sendDaily === undefined ? a.send_daily : sendDaily ? 1 : 0,
      now,
      articleId,
    );
    // Promote linked facts, deals and decisions to verified.
    run("UPDATE facts SET status = 'verified', verified_at = COALESCE(verified_at, ?) WHERE article_id = ? AND status = 'unverified'", now, articleId);
    run("UPDATE deals SET verified = 1 WHERE article_id = ?", articleId);
    run("UPDATE regulatory_decisions SET verified = 1 WHERE article_id = ?", articleId);
    for (const e of all<{ entity_type: string; entity_id: number }>("SELECT entity_type, entity_id FROM article_entities WHERE article_id = ?", articleId)) {
      if (e.entity_type === "deal") run("UPDATE deals SET verified = 1 WHERE id = ?", e.entity_id);
      if (e.entity_type === "regulatory") run("UPDATE regulatory_decisions SET verified = 1 WHERE id = ?", e.entity_id);
    }
    if (a.candidate_id) run("UPDATE extracted_items SET status = 'writing', article_id = ? WHERE id = ?", articleId, a.candidate_id);
  });

  const published = articleById(articleId)!;
  if (published.content_type === "story" && published.send_daily) {
    const existing = get("SELECT 1 FROM newsletter_issues WHERE article_id = ? AND status IN ('scheduled','sending','sent')", articleId);
    if (!existing) createDailyStoryIssue(published);
  }
  snapshot(articleId, actor?.id ?? null);
  audit(actor, "publish", "article", articleId, { status: a.status }, { status: "published", published_at: published.published_at });
  return published;
}

declare global {
  // eslint-disable-next-line no-var
  var __medtwentyTick: number | undefined;
}

/**
 * Run due background work: scheduled articles, scheduled newsletter issues
 * and the 13-month retention job. Called opportunistically on requests
 * (throttled) and by /api/cron for a real scheduler.
 */
export async function tick(force = false) {
  const now = Date.now();
  if (!force && globalThis.__medtwentyTick && now - globalThis.__medtwentyTick < 30_000) return;
  globalThis.__medtwentyTick = now;
  const iso = new Date(now).toISOString();

  for (const a of all<{ id: number }>("SELECT id FROM articles WHERE status = 'scheduled' AND scheduled_for <= ?", iso)) {
    try {
      publishArticle(a.id, null);
    } catch (e) {
      run("UPDATE articles SET status = 'approved', review_note = ? WHERE id = ?", `Scheduled publish failed: ${(e as Error).message}`, a.id);
    }
  }
  for (const i of all<{ id: number }>("SELECT id FROM newsletter_issues WHERE status = 'scheduled' AND scheduled_for <= ?", iso)) {
    await sendIssue(i.id);
  }
  // Retention: anonymous reads and page views older than 13 months.
  const cutoff = new Date(now - 395 * 86400_000).toISOString();
  run("DELETE FROM page_views WHERE created_at < ?", cutoff);
  run("DELETE FROM premium_reads WHERE created_at < ?", cutoff);
}
