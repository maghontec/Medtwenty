// Database schema. Rows are deactivated rather than deleted wherever the build
// pack says "deactivate, never delete". `source` = 'seed' marks sample data.

export const SCHEMA = /* sql */ `
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1,
  legacy_category_id INTEGER REFERENCES categories(id),
  redirect_to_id INTEGER REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS editions (
  id INTEGER PRIMARY KEY,
  week_start TEXT NOT NULL UNIQUE,
  week_label TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT,
  password_hash TEXT,
  email_confirmed_at TEXT,
  confirm_token TEXT,
  reset_token TEXT,
  reset_expires_at TEXT,
  stripe_customer_id TEXT,
  last_seen_at TEXT,
  previous_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  source TEXT NOT NULL DEFAULT 'signup'
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'member',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin','editor','contributor')),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS plans (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_month_pence INTEGER,
  price_year_pence INTEGER,
  features TEXT NOT NULL DEFAULT '[]',
  watchlist_limit INTEGER NOT NULL DEFAULT 3,
  is_public INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 100,
  stripe_price_month_test TEXT,
  stripe_price_year_test TEXT,
  stripe_price_month_live TEXT,
  stripe_price_year_live TEXT
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL REFERENCES plans(code),
  interval TEXT NOT NULL DEFAULT 'month',
  status TEXT NOT NULL,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  past_due_since TEXT,
  stripe_subscription_id TEXT UNIQUE,
  conversion_source TEXT,
  consent_at TEXT,
  mode TEXT NOT NULL DEFAULT 'test',
  amount_pence INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount_pence INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'gbp',
  stripe_invoice_id TEXT UNIQUE,
  mode TEXT NOT NULL DEFAULT 'test',
  paid_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS demo_checkouts (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL,
  interval TEXT NOT NULL,
  conversion_source TEXT,
  consent_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT,
  processed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS comp_grants (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  plan_code TEXT NOT NULL REFERENCES plans(code),
  until TEXT,
  revoked_at TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sector TEXT,
  country TEXT DEFAULT 'GB',
  website TEXT,
  description TEXT,
  is_stub INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  headline TEXT NOT NULL,
  standfirst TEXT,
  body TEXT NOT NULL DEFAULT '',
  why_it_matters TEXT,
  source_outlet TEXT,
  source_url TEXT,
  content_type TEXT NOT NULL DEFAULT 'story' CHECK (content_type IN ('story','briefing','analysis')),
  category_id INTEGER REFERENCES categories(id),
  legacy_category_id INTEGER REFERENCES categories(id),
  topics TEXT,
  is_premium INTEGER NOT NULL DEFAULT 0,
  is_editors_pick INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','review','approved','scheduled','published','rejected','retracted')),
  review_note TEXT,
  scheduled_for TEXT,
  published_at TEXT,
  edition_id INTEGER REFERENCES editions(id),
  edition_rank INTEGER,
  hero_image_url TEXT,
  hero_alt TEXT,
  seo_title TEXT,
  seo_description TEXT,
  editorial_minutes INTEGER,
  author_name TEXT,
  read_minutes INTEGER,
  send_daily INTEGER NOT NULL DEFAULT 1,
  candidate_id INTEGER,
  views INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_articles_pub ON articles(status, published_at);

CREATE TABLE IF NOT EXISTS article_versions (
  id INTEGER PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  snapshot TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS briefing_items (
  briefing_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  PRIMARY KEY (briefing_id, article_id)
);

CREATE TABLE IF NOT EXISTS article_entities (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('company','deal','regulatory')),
  entity_id INTEGER NOT NULL,
  PRIMARY KEY (article_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS facts (
  id INTEGER PRIMARY KEY,
  article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
  extracted_item_id INTEGER,
  kind TEXT NOT NULL DEFAULT 'figure',
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified','verified','rejected')),
  provenance TEXT,
  verified_by INTEGER REFERENCES users(id),
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY,
  deal_type TEXT NOT NULL DEFAULT 'acquisition' CHECK (deal_type IN ('acquisition','funding','restructuring')),
  acquirer TEXT,
  target TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id),
  sector TEXT,
  value_text TEXT,
  value_usd_m REAL,
  round TEXT,
  investors TEXT,
  status TEXT NOT NULL DEFAULT 'announced' CHECK (status IN ('announced','closed','rumoured')),
  announced_on TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS regulatory_decisions (
  id INTEGER PRIMARY KEY,
  product TEXT NOT NULL,
  company TEXT,
  company_id INTEGER REFERENCES companies(id),
  regulator TEXT NOT NULL,
  decision TEXT NOT NULL DEFAULT 'pending' CHECK (decision IN ('approved','rejected','pending','guidance')),
  decided_on TEXT,
  summary TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS corrections (
  id INTEGER PRIMARY KEY,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'correction' CHECK (kind IN ('correction','retraction','factual_error')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','published')),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS premium_reads (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, article_id, month)
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, company_id)
);

CREATE TABLE IF NOT EXISTS newsletters (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  cadence TEXT,
  is_premium INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INTEGER PRIMARY KEY,
  newsletter_id INTEGER NOT NULL REFERENCES newsletters(id),
  email TEXT NOT NULL COLLATE NOCASE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','unsubscribed')),
  token TEXT NOT NULL,
  consent_at TEXT,
  source TEXT,
  unsubscribed_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (newsletter_id, email)
);

CREATE TABLE IF NOT EXISTS newsletter_issues (
  id INTEGER PRIMARY KEY,
  newsletter_id INTEGER NOT NULL REFERENCES newsletters(id),
  subject TEXT NOT NULL,
  preheader TEXT,
  blocks TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','sending','sent','canceled')),
  scheduled_for TEXT,
  sent_at TEXT,
  article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
  recipients INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id INTEGER PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  kind TEXT NOT NULL,
  issue_id INTEGER REFERENCES newsletter_issues(id) ON DELETE SET NULL,
  provider_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS email_events (
  id INTEGER PRIMARY KEY,
  outbox_id INTEGER REFERENCES email_outbox(id) ON DELETE CASCADE,
  issue_id INTEGER,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  feed_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'rss' CHECK (source_type IN ('rss','monitor','manual')),
  category_slug TEXT,
  cadence TEXT NOT NULL DEFAULT 'daily' CHECK (cadence IN ('multiple_daily','daily','weekly','event')),
  is_active INTEGER NOT NULL DEFAULT 1,
  needs_verification INTEGER NOT NULL DEFAULT 0,
  last_checked_at TEXT,
  last_success_at TEXT,
  last_error TEXT,
  items_last_run INTEGER
);

CREATE TABLE IF NOT EXISTS extracted_items (
  id INTEGER PRIMARY KEY,
  external_id TEXT UNIQUE,
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual','ingest')),
  source_id INTEGER REFERENCES sources(id),
  source_url TEXT NOT NULL,
  source_outlet TEXT,
  published_at TEXT,
  suggested_category TEXT,
  raw_title TEXT NOT NULL,
  ai_summary TEXT,
  note TEXT,
  significance_score INTEGER,
  payload TEXT,
  ticks TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','writing','saved_analysis','dismissed')),
  dismiss_reason TEXT,
  article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id INTEGER PRIMARY KEY,
  external_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'running',
  started_at TEXT,
  finished_at TEXT,
  counts TEXT,
  errors TEXT
);

CREATE TABLE IF NOT EXISTS indices (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  value REAL,
  change_pct REAL,
  is_public INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  actor_id INTEGER,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL,
  anon_id TEXT,
  user_id INTEGER,
  article_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_pv_created ON page_views(created_at);

CREATE TABLE IF NOT EXISTS redirects (
  from_path TEXT PRIMARY KEY,
  to_path TEXT NOT NULL,
  note TEXT
);

CREATE TABLE IF NOT EXISTS legal_pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  reviewed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS launch_checks (
  key TEXT PRIMARY KEY,
  done_at TEXT
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;
