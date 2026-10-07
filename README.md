# MedTwenty

UK Healthcare Business Intelligence — the MedTwenty web app, built to the **MedTwenty Lovable Build Prompts v2** (weekly operating model).

One verified story each weekday, a Friday briefing and a monthly analysis, run by one editor in about 10 hours a week.

## Screenshots

See `docs/screenshots/` for the homepage, an article, membership and the Control Room.

## Run it

```bash
npm install
cp .env.example .env.local   # optional: everything works without keys
npm run dev                  # http://localhost:3000
```

Requires Node 22.13+ (uses the built-in `node:sqlite`). The database is created at `data/medtwenty.db` on first request and filled with sample content marked as sample data. `npm run db:reset` starts again.

**Control Room:** go to `/admin/login`, enter `maghontec@gmail.com` with a password of 12+ characters, tick *First sign-in for the owner account*, then press **Claim super admin**.

## What is built (by prompt)

| Prompt | Where |
| --- | --- |
| R.1 Master brief | Copy everywhere follows the weekly model and the honesty rule (no "Today's Twenty", "300 stories", "real-time") |
| R.2 Launch posture | 5 active categories (14 legacy kept inactive, old URLs redirect), weekly editions (`Week 41, 2026`), `content_type`, `editorial_minutes`, `is_public` plans, 3 active newsletters, reveal flags with launch defaults |
| R.3 Homepage and copy | `/` lead · This week (+ Last week on quiet weeks) · The MedTwenty Weekly · Monthly analysis · Deal and Regulatory previews · newsletters · Most read (after 10 pieces). `/news`, `/news/briefings`, `/news/analysis`, `/membership`, `/about`, `/editorial-standards`, `/newsletters` |
| 3.1–3.2 | Sign-in, metered paywall (anonymous: 1 Premium piece a month; Free: 3) |
| 3.3 Stripe | Premium only, monthly/annual from the plans table, immediate-access consent, webhooks (idempotent), 7-day past-due grace banner, billing portal, VAT switch, `grant_comp_plan` (orudigital@gmail.com has Premium) |
| G.1 Control Room | `/admin` — separate staff sign-in, Overview, Members, Site settings (every flag), Audit log with diffs |
| G.2 Editorial | Shortlist (4 selection ticks), Story pipeline, Article editor (autosave 10s, timer, facts panel blocks publishing, entities, SEO snippet, hero image library, versions, live preview) |
| G.3 Weekly briefing | Drag to order up to 5, overview, publishes a briefing and drafts The MedTwenty Weekly; edition history; monthly analysis tab |
| G.4 Email | Resend templates, double opt-in, Daily Story auto-issue 10 minutes after publish, Weekly and Analyst Note issues, batches, bounces/complaints webhook, CSV export, GDPR delete |
| G.5 Member area | `/dashboard` and `/premium-dashboard`: this week, briefing, analysis, followed companies (3/25, server-enforced), newsletter switches, plan and billing, since-last-visit, meter, archive |
| G.6 Metrics | `/admin/metrics`: the seven operating-plan measures with weekly trends, returning-reader rankings, month-3 and month-6 reviews |
| G.7 Compliance | Cookie consent (analytics only after consent), checkout disclosures, data export and account deletion, 13-month retention, draft legal pages with review status, skip link, focus states, labelled forms, security headers, rate limits |
| G.8 SEO and launch | Per-page titles/descriptions/canonicals, OG image (`/og`), NewsArticle (with paywall markup), Organization, Breadcrumb, WebSite SearchAction, sitemap index + Google News sitemap, robots.txt, redirects table, "Remove all sample data", pre-launch checklist and Launch button |
| A.1–A.2 Automation | `/api/ingest/items|drafts|runs|sources` (bearer token, schema validation, idempotent, rate-limited, daily cap), entity matching, unverified facts, n8n draft webhook, `/admin/sources`, `/admin/ingestion/docs` |

## Connecting services

| Service | Set | Without it |
| --- | --- | --- |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; webhook to `/api/stripe/webhook` | A built-in test checkout runs the same subscription logic (cards 4242… and 4000 0000 0000 0341) |
| Resend | `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_WEBHOOK_SECRET`; webhook to `/api/resend/webhook` | Emails are written to Control Room → Newsletters → Outbox |
| n8n | `INGEST_API_SECRET`, `N8N_DRAFT_URL`, `N8N_TRIGGER_SECRET` | Add candidates by hand on the Shortlist |
| Scheduler | `CRON_SECRET`; call `GET /api/cron` every minute | Scheduled items are also processed on normal page loads |

Stripe goes live only after the checklist (G.8): put live keys in, press *Create / check prices* on `/admin/launch`, register the live webhook, then **Launch**.

## Hosting

The app keeps its data in SQLite, so host it where the `data/` folder persists (a VPS, Railway, Render or Fly.io with a volume). Set `APP_URL=https://medtwenty.com`.

## Images

Story images live in `public/images/stories/` and appear in the article editor's image picker. Add more files there (webp/jpg/png) or paste a licensed image URL.

## Not yet included

- Sign in with Google (email and password only for now).
- In-app AI image generation: the editor shows the house-style prompt to use in your image tool.
- Later-stage features (alerts, indices, research centre, Professional/Corporate tiers, US edition) are kept behind flags or hidden plans as the pack describes.
