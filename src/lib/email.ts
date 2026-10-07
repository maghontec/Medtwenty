import "server-only";
import { all, get, run } from "./db";
import { appUrl, getSettings } from "./settings";
import { escapeHtml } from "./format";

// Email via Resend when RESEND_API_KEY is set. Without a key, every email is
// still rendered and stored in email_outbox (visible in Control Room >
// Newsletters > Outbox), so the full flow can be tested locally.

const COMPLIANCE =
  "MedTwenty Indices and trackers are editorial indicators and business information. They are not investment, financial, legal or medical advice, and not a regulated benchmark.";

export function layout(opts: { title: string; preheader?: string; body: string; unsubscribeUrl?: string }): string {
  const s = getSettings();
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;background:#f6f1e7;font-family:Inter,Helvetica,Arial,sans-serif;color:#1f2228">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(opts.preheader || "")}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f1e7"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e7dfd1">
<tr><td style="padding:28px 32px 12px;border-bottom:3px solid #a64f1c">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:700;letter-spacing:-0.5px">Med<span style="color:#a64f1c">Twenty</span></div>
<div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#555;margin-top:4px">${escapeHtml(s.descriptor)}</div>
</td></tr>
<tr><td style="padding:28px 32px;font-size:16px;line-height:1.6">${opts.body}</td></tr>
<tr><td style="padding:20px 32px;background:#faf7f1;font-size:12px;line-height:1.5;color:#666">
<p style="margin:0 0 8px">${escapeHtml(s.tagline)}</p>
<p style="margin:0 0 8px">MedTwenty is a trading name of ${escapeHtml(s.company_name)}. ${escapeHtml(s.company_address)}.</p>
<p style="margin:0 0 8px">${COMPLIANCE}</p>
${opts.unsubscribeUrl ? `<p style="margin:0"><a href="${opts.unsubscribeUrl}" style="color:#8f4317">Unsubscribe</a></p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
}

export function h(text: string) {
  return `<h1 style="font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.25;margin:0 0 16px">${escapeHtml(text)}</h1>`;
}
export function p(text: string) {
  return `<p style="margin:0 0 16px">${escapeHtml(text)}</p>`;
}
export function button(href: string, label: string) {
  return `<p style="margin:24px 0"><a href="${href}" style="background:#a64f1c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:4px;font-weight:600;display:inline-block">${escapeHtml(label)}</a></p>`;
}

type SendOpts = {
  to: string;
  subject: string;
  html: string;
  kind: string;
  issueId?: number;
  unsubscribeUrl?: string;
};

export async function sendEmail(o: SendOpts): Promise<{ ok: boolean; id: number }> {
  const r = run(
    "INSERT INTO email_outbox (to_email, subject, html, kind, issue_id, status) VALUES (?, ?, ?, ?, ?, 'queued')",
    o.to,
    o.subject,
    o.html,
    o.kind,
    o.issueId ?? null,
  );
  const id = r.lastId;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    run("UPDATE email_outbox SET status = 'logged' WHERE id = ?", id);
    return { ok: true, id };
  }
  try {
    const headers: Record<string, string> = {};
    if (o.unsubscribeUrl) {
      headers["List-Unsubscribe"] = `<${o.unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "MedTwenty <newsroom@mail.medtwenty.com>",
        to: [o.to],
        subject: o.subject,
        html: o.html,
        headers,
        tags: [{ name: "outbox_id", value: String(id) }],
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) throw new Error(json.message || `Resend error ${res.status}`);
    run("UPDATE email_outbox SET status = 'sent', provider_id = ? WHERE id = ?", json.id ?? null, id);
    return { ok: true, id };
  } catch (e) {
    run("UPDATE email_outbox SET status = 'failed', error = ? WHERE id = ?", String((e as Error).message), id);
    return { ok: false, id };
  }
}

// ---------- Transactional templates ----------

export async function sendConfirmEmail(email: string, confirmToken: string) {
  const url = `${appUrl()}/auth/confirm?token=${encodeURIComponent(confirmToken)}`;
  return sendEmail({
    to: email,
    subject: "Confirm your MedTwenty account",
    kind: "auth_confirm",
    html: layout({
      title: "Confirm your account",
      body: h("Confirm your email") + p("Confirm your email address to finish creating your MedTwenty account.") + button(url, "Confirm email"),
    }),
  });
}

export async function sendResetEmail(email: string, resetToken: string) {
  const url = `${appUrl()}/auth/reset?token=${encodeURIComponent(resetToken)}`;
  return sendEmail({
    to: email,
    subject: "Reset your MedTwenty password",
    kind: "auth_reset",
    html: layout({
      title: "Reset your password",
      body: h("Reset your password") + p("Use the button below within one hour to choose a new password. If you did not ask for this, ignore this email.") + button(url, "Choose a new password"),
    }),
  });
}

export async function sendWelcomeEmail(email: string, premium: boolean, terms?: { price: string; interval: string; vat: string }) {
  const body = premium
    ? h("Welcome to MedTwenty Premium") +
      p("You now have unlimited Premium articles, the monthly analysis, the full archive and The Analyst Note.") +
      (terms
        ? p(`Your plan: Premium, ${terms.price} per ${terms.interval}${terms.vat}. It renews automatically at the end of each ${terms.interval} until you cancel. Cancel any time from Manage billing on your dashboard; access continues to the end of the period you have paid for. You agreed that access starts immediately and that you lose the 14-day cancellation right once access begins.`)
        : "") +
      button(`${appUrl()}/premium-dashboard`, "Open your dashboard")
    : h("Welcome to MedTwenty") +
      p("One verified story each weekday, a briefing every Friday, and three Premium articles a month on us.") +
      button(`${appUrl()}/dashboard`, "Open your dashboard");
  return sendEmail({ to: email, subject: premium ? "Welcome to MedTwenty Premium" : "Welcome to MedTwenty", kind: "welcome", html: layout({ title: "Welcome", body }) });
}

export async function sendPaymentFailedEmail(email: string) {
  return sendEmail({
    to: email,
    subject: "Your MedTwenty payment failed",
    kind: "payment_failed",
    html: layout({
      title: "Payment failed",
      body:
        h("Your payment failed") +
        p("We could not take your latest Premium payment. You keep access for 7 days while you update your card.") +
        button(`${appUrl()}/premium-dashboard`, "Update your card"),
    }),
  });
}

export async function sendNewsletterConfirm(email: string, tokenValue: string, names: string[]) {
  const url = `${appUrl()}/newsletters/confirm?token=${encodeURIComponent(tokenValue)}`;
  return sendEmail({
    to: email,
    subject: "Confirm your MedTwenty newsletter subscription",
    kind: "newsletter_optin",
    html: layout({
      title: "Confirm your subscription",
      body: h("Confirm your subscription") + p(`Confirm that you would like to receive: ${names.join(", ")}.`) + button(url, "Confirm subscription") + p("If you did not ask for this, ignore this email and you will not be subscribed."),
    }),
  });
}

export async function notifyEditor(subject: string, text: string, link?: string) {
  const staff = all<{ email: string }>("SELECT u.email FROM users u JOIN user_roles r ON r.user_id = u.id WHERE r.role IN ('super_admin','editor') GROUP BY u.email");
  for (const s of staff) {
    await sendEmail({
      to: s.email,
      subject,
      kind: "editor_notification",
      html: layout({ title: subject, body: h(subject) + p(text) + (link ? button(link, "Open in the Control Room") : "") }),
    });
  }
}

export function unsubscribeUrl(tokenValue: string) {
  return `${appUrl()}/unsubscribe?token=${encodeURIComponent(tokenValue)}`;
}

export function subscriberToken(newsletterId: number, email: string): string | null {
  return get<{ token: string }>("SELECT token FROM newsletter_subscribers WHERE newsletter_id = ? AND email = ?", newsletterId, email)?.token ?? null;
}
