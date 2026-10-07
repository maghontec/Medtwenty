import "server-only";
import { all, get, run } from "./db";
import { token } from "./auth";
import { layout, sendEmail, sendNewsletterConfirm, unsubscribeUrl } from "./email";
import { appUrl } from "./settings";
import { escapeHtml } from "./format";
import { activeNewsletters, articleById, briefingItems, type Article } from "./content";
import { entitlementFor } from "./entitlements";
import type { User } from "./auth";

export type IssueBlocks = {
  intro?: string;
  stories?: { headline: string; standfirst?: string; why?: string; url: string; premium?: boolean }[];
  overview?: string;
  signoff?: string;
};

export type Issue = {
  id: number;
  newsletter_id: number;
  newsletter_name?: string;
  newsletter_slug?: string;
  subject: string;
  preheader: string | null;
  blocks: string;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
  article_id: number | null;
  recipients: number;
  created_at: string;
};

/**
 * Subscribe an email to newsletters. Visitors get a double opt-in email;
 * signed-in members with a confirmed email are confirmed straight away.
 */
export async function subscribe(email: string, slugs: string[], source: string, user?: User | null) {
  const active = activeNewsletters().filter((n) => slugs.includes(n.slug));
  const ent = entitlementFor(user ?? null);
  const allowed = active.filter((n) => !n.is_premium || ent.premium);
  if (allowed.length === 0) return { pending: 0, confirmed: 0 };
  const trusted = !!user && !!user.email_confirmed_at && user.email.toLowerCase() === email.toLowerCase();
  const tokens: string[] = [];
  const names: string[] = [];
  const now = new Date().toISOString();
  for (const n of allowed) {
    const existing = get<{ id: number; status: string; token: string }>(
      "SELECT id, status, token FROM newsletter_subscribers WHERE newsletter_id = ? AND email = ?",
      n.id,
      email,
    );
    if (existing?.status === "confirmed") continue;
    if (existing) {
      run(
        "UPDATE newsletter_subscribers SET status = ?, source = ?, consent_at = ?, user_id = COALESCE(user_id, ?), unsubscribed_reason = NULL WHERE id = ?",
        trusted ? "confirmed" : "pending",
        source,
        trusted ? now : null,
        user?.id ?? null,
        existing.id,
      );
      tokens.push(existing.token);
    } else {
      const t = token(18);
      run(
        "INSERT INTO newsletter_subscribers (newsletter_id, email, user_id, status, token, consent_at, source) VALUES (?, ?, ?, ?, ?, ?, ?)",
        n.id,
        email.toLowerCase(),
        user?.id ?? null,
        trusted ? "confirmed" : "pending",
        t,
        trusted ? now : null,
        source,
      );
      tokens.push(t);
    }
    names.push(n.name);
  }
  if (!trusted && tokens.length) await sendNewsletterConfirm(email, tokens.join(","), names);
  return trusted ? { pending: 0, confirmed: names.length } : { pending: names.length, confirmed: 0 };
}

export function confirmTokens(tokens: string[]): number {
  let n = 0;
  for (const t of tokens) {
    n += run(
      "UPDATE newsletter_subscribers SET status = 'confirmed', consent_at = ? WHERE token = ? AND status = 'pending'",
      new Date().toISOString(),
      t,
    ).changes;
  }
  return n;
}

export function unsubscribeToken(t: string, reason = "link") {
  const row = get<{ id: number; name: string; email: string }>(
    "SELECT s.id, n.name, s.email FROM newsletter_subscribers s JOIN newsletters n ON n.id = s.newsletter_id WHERE s.token = ?",
    t,
  );
  if (!row) return null;
  run("UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_reason = ? WHERE id = ?", reason, row.id);
  return row;
}

export function memberNewsletterStatus(email: string) {
  return all<{ slug: string; status: string }>(
    "SELECT n.slug, s.status FROM newsletter_subscribers s JOIN newsletters n ON n.id = s.newsletter_id WHERE s.email = ?",
    email,
  );
}

export function setMemberNewsletter(user: User, slug: string, on: boolean) {
  const n = get<{ id: number; is_premium: number; is_active: number }>("SELECT id, is_premium, is_active FROM newsletters WHERE slug = ?", slug);
  if (!n || !n.is_active) throw new Error("Unknown newsletter");
  if (on && n.is_premium && !entitlementFor(user).premium) throw new Error("Premium only");
  const existing = get<{ id: number }>("SELECT id FROM newsletter_subscribers WHERE newsletter_id = ? AND email = ?", n.id, user.email);
  if (existing) {
    run(
      "UPDATE newsletter_subscribers SET status = ?, consent_at = CASE WHEN ? THEN ? ELSE consent_at END, unsubscribed_reason = ? WHERE id = ?",
      on ? "confirmed" : "unsubscribed",
      on ? 1 : 0,
      new Date().toISOString(),
      on ? null : "dashboard",
      existing.id,
    );
  } else if (on) {
    run(
      "INSERT INTO newsletter_subscribers (newsletter_id, email, user_id, status, token, consent_at, source) VALUES (?, ?, ?, 'confirmed', ?, ?, 'dashboard')",
      n.id,
      user.email,
      user.id,
      token(18),
      new Date().toISOString(),
    );
  }
}

// ---------- Issues ----------

export function articleUrl(a: Pick<Article, "slug">) {
  return `${appUrl()}/news/${a.slug}`;
}

export function renderIssueHtml(issue: Pick<Issue, "subject" | "preheader" | "blocks">, unsubscribe?: string): string {
  const b = JSON.parse(issue.blocks || "{}") as IssueBlocks;
  const parts: string[] = [];
  parts.push(`<h1 style="font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;margin:0 0 16px">${escapeHtml(issue.subject)}</h1>`);
  if (b.intro) parts.push(paras(b.intro));
  if (b.overview) parts.push(`<div style="border-left:3px solid #a64f1c;padding-left:16px;margin:0 0 24px">${paras(b.overview)}</div>`);
  for (const [i, s] of (b.stories || []).entries()) {
    parts.push(`<div style="border-top:1px solid #e7dfd1;padding:16px 0">
<div style="font-family:Georgia,serif;color:#a64f1c;font-size:20px;font-weight:700">${(b.stories || []).length > 1 ? i + 1 : ""}</div>
<h2 style="font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.3;margin:4px 0 8px"><a href="${s.url}" style="color:#1f2228;text-decoration:none">${escapeHtml(s.headline)}</a>${s.premium ? ' <span style="font-family:Inter,Arial,sans-serif;font-size:11px;letter-spacing:1px;color:#8f4317">PREMIUM</span>' : ""}</h2>
${s.standfirst ? `<p style="margin:0 0 8px;color:#444">${escapeHtml(s.standfirst)}</p>` : ""}
${s.why ? `<p style="margin:0 0 8px"><strong>Why it matters:</strong> ${escapeHtml(s.why)}</p>` : ""}
<p style="margin:0"><a href="${s.url}" style="color:#8f4317;font-weight:600">Read on MedTwenty</a></p></div>`);
  }
  if (b.signoff) parts.push(paras(b.signoff));
  return layout({ title: issue.subject, preheader: issue.preheader || undefined, body: parts.join("\n"), unsubscribeUrl: unsubscribe });
}

function paras(text: string) {
  return text
    .split(/\n{2,}/)
    .map((t) => `<p style="margin:0 0 16px">${escapeHtml(t.trim())}</p>`)
    .join("");
}

export function newsletterId(slug: string): number {
  return get<{ id: number }>("SELECT id FROM newsletters WHERE slug = ?", slug)!.id;
}

/** Daily Story issue for a just-published story, sent 10 minutes later so the editor can cancel. */
export function createDailyStoryIssue(article: Article): number {
  const blocks: IssueBlocks = {
    stories: [
      {
        headline: article.headline,
        standfirst: article.standfirst || undefined,
        why: article.why_it_matters || undefined,
        url: articleUrl(article),
        premium: !!article.is_premium,
      },
    ],
    signoff: article.is_premium
      ? "This is a Premium story. Free members can read three Premium articles a month."
      : "Reply to this email to tell us what we should be covering.",
  };
  const r = run(
    "INSERT INTO newsletter_issues (newsletter_id, subject, preheader, blocks, status, scheduled_for, article_id) VALUES (?, ?, ?, ?, 'scheduled', ?, ?)",
    newsletterId("daily-story"),
    article.headline,
    article.standfirst || "",
    JSON.stringify(blocks),
    new Date(Date.now() + 10 * 60_000).toISOString(),
    article.id,
  );
  return r.lastId;
}

export function createWeeklyIssueFromBriefing(briefingId: number): number {
  const brief = articleById(briefingId)!;
  const items = briefingItems(briefingId);
  const blocks: IssueBlocks = {
    overview: brief.body.replace(/^##\s+Overview\s*/i, "").replace(/^#+\s.*$/gm, "").trim(),
    stories: items.map((a) => ({ headline: a.headline, standfirst: a.standfirst || undefined, url: articleUrl(a), premium: !!a.is_premium })),
    signoff: "Have a good weekend. The MedTwenty editor",
  };
  // Default schedule: Friday 17:00 UK time (left as a draft for the editor to review).
  const r = run(
    "INSERT INTO newsletter_issues (newsletter_id, subject, preheader, blocks, status, article_id) VALUES (?, ?, ?, ?, 'draft', ?)",
    newsletterId("weekly"),
    brief.headline,
    brief.standfirst || "",
    JSON.stringify(blocks),
    briefingId,
  );
  return r.lastId;
}

export function createAnalystNoteIssue(articleId: number): number {
  const a = articleById(articleId)!;
  const blocks: IssueBlocks = {
    intro: "This month's original analysis for Premium members.",
    stories: [{ headline: a.headline, standfirst: a.standfirst || undefined, why: a.why_it_matters || undefined, url: articleUrl(a), premium: true }],
  };
  const r = run(
    "INSERT INTO newsletter_issues (newsletter_id, subject, preheader, blocks, status, article_id) VALUES (?, ?, ?, ?, 'draft', ?)",
    newsletterId("analyst-note"),
    `The Analyst Note: ${a.headline}`,
    a.standfirst || "",
    JSON.stringify(blocks),
    articleId,
  );
  return r.lastId;
}

/** Send an issue in batches to confirmed subscribers, checking Premium entitlement for Premium newsletters. */
export async function sendIssue(issueId: number): Promise<number> {
  const issue = get<Issue & { is_premium: number }>(
    "SELECT i.*, n.is_premium FROM newsletter_issues i JOIN newsletters n ON n.id = i.newsletter_id WHERE i.id = ?",
    issueId,
  );
  if (!issue || issue.status === "sent" || issue.status === "canceled") return 0;
  run("UPDATE newsletter_issues SET status = 'sending' WHERE id = ?", issueId);
  const subs = all<{ email: string; token: string }>(
    "SELECT email, token FROM newsletter_subscribers WHERE newsletter_id = ? AND status = 'confirmed' ORDER BY id",
    issue.newsletter_id,
  );
  let sent = 0;
  const BATCH = 50;
  for (let i = 0; i < subs.length; i += BATCH) {
    const batch = subs.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (s) => {
        if (issue.is_premium) {
          const u = get<User>("SELECT * FROM users WHERE email = ?", s.email);
          if (!u || !entitlementFor(u).premium) return;
        }
        const unsub = unsubscribeUrl(s.token);
        const r = await sendEmail({ to: s.email, subject: issue.subject, html: renderIssueHtml(issue, unsub), kind: "newsletter", issueId, unsubscribeUrl: unsub });
        if (r.ok) sent++;
      }),
    );
  }
  run("UPDATE newsletter_issues SET status = 'sent', sent_at = ?, recipients = ? WHERE id = ?", new Date().toISOString(), sent, issueId);
  return sent;
}

export async function sendTestIssue(issueId: number, to: string) {
  const issue = get<Issue>("SELECT * FROM newsletter_issues WHERE id = ?", issueId);
  if (!issue) throw new Error("Issue not found");
  return sendEmail({ to, subject: `[Test] ${issue.subject}`, html: renderIssueHtml(issue, `${appUrl()}/unsubscribe`), kind: "newsletter_test" });
}
