// Site settings and reveal flags, with the launch posture from prompt R.2.

export const DEFAULT_SETTINGS = {
  site_name: "MedTwenty",
  descriptor: "UK Healthcare Business Intelligence",
  tagline: "The healthcare business stories that matter, verified.",
  meta_description:
    "Verified UK healthcare business intelligence: one story each weekday, a Friday briefing and a monthly analysis.",
  company_name: "Vanadium Media Group Ltd",
  company_address: "Registered in England and Wales",
  contact_email: "editor@medtwenty.com",
  social_linkedin: "",
  social_x: "",
  vat_registered: false,
  launch_mode: true,
  launch_date: "",
  rebrand_notice: true,
  show_intelligence_nav: false,
  show_indices_strip: false,
  show_paid_tiers: true,
  show_api_page: false,
  show_research_centre: false,
  show_us_edition: false,
  show_canada_edition: false,
  show_deal_tracker: true,
  show_regulatory_pipeline: true,
  show_waiting_list: false,
  ingest_daily_cap: 50,
  ingest_paused: false,
};

export type SettingKey = keyof typeof DEFAULT_SETTINGS;

export const FLAG_DESCRIPTIONS: Partial<Record<SettingKey, string>> = {
  tagline: "Shown in the homepage edition bar and email footers.",
  meta_description: "Default meta description for pages without their own.",
  vat_registered:
    "When on, prices show \"+ VAT\" and Stripe Tax is used for UK VAT. When off, prices are final with no VAT line.",
  launch_mode: "On until you press Launch on the checklist. Shows the test-mode payments banner on the preview.",
  launch_date: "Set by the Launch button. Drives the month-3 and month-6 review reminders on Metrics.",
  rebrand_notice: "Shows the \"VanadiumNews is now MedTwenty\" bar. Switch off about three months after launch.",
  show_intelligence_nav: "Adds Intelligence (companies, investors, executives) to the main navigation.",
  show_indices_strip: "Shows the MedTwenty Indices ticker on the homepage. Only public indices appear.",
  show_paid_tiers: "Shows Premium pricing and upgrade buttons. Hidden plans never appear either way.",
  show_api_page: "Shows the API page and its header link.",
  show_research_centre: "Shows the Research Centre and its navigation link.",
  show_us_edition: "Shows the United States edition tab in the utility bar.",
  show_canada_edition: "Shows the Canada edition tab in the utility bar.",
  show_deal_tracker: "Shows the Deal Flow Tracker page, its homepage preview and navigation link.",
  show_regulatory_pipeline: "Shows the Regulatory Pipeline page, its homepage preview and navigation link.",
  show_waiting_list: "Shows the NHS Waiting List Monitor. Keep off unless you will keep up monthly RTT uploads.",
  ingest_daily_cap: "Maximum items the n8n pipeline may post to /api/ingest/items per day.",
  ingest_paused: "Pauses all ingestion: the ingest API refuses new items and returns no active sources.",
};
