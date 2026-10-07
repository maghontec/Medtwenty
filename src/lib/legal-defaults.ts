// Draft legal pages for the launch scope. Shown publicly, but marked
// "Draft for legal review" in the Control Room until reviewed.

export const LEGAL_DEFAULTS: Record<string, { title: string; body: string }> = {
  privacy: {
    title: "Privacy notice",
    body: `MedTwenty is a trading name of Vanadium Media Group Ltd, the controller of your personal data.

## What we collect
- **Account data**: your email address, name (optional) and password hash when you create an account.
- **Subscription data**: your plan, billing status and renewal date. Card details are handled by Stripe and never reach us.
- **Newsletter data**: the newsletters you subscribe to, when and where you gave consent, and whether you open or click our emails.
- **Reading data**: which Premium articles you have read this month, so we can apply the free monthly allowance.
- **Analytics**: pages viewed, with a first-party anonymous identifier, only if you accept analytics cookies.

## Why we use it
To provide the service you signed up for (contract), to send newsletters you asked for (consent), to keep the service secure (legitimate interests), and to meet legal and tax obligations.

## Processors
- **Stripe** for payments.
- **Resend** for email delivery.
- **Lovable Cloud** for hosting and the database.

## Retention
Anonymous reading and page-view records are deleted after 13 months. Account data is kept while you have an account and deleted when you delete it, except billing records we must keep for tax purposes.

## Your rights
You can download your data or delete your account from your account page, and unsubscribe from any newsletter with one click. You can also contact us or complain to the Information Commissioner's Office (ico.org.uk).`,
  },
  terms: {
    title: "Terms of use",
    body: `These terms apply to medtwenty.com, operated by Vanadium Media Group Ltd.

## Membership
- **Free**: every story not marked Premium, the weekly briefing, three Premium articles a month, following up to three companies, and the free newsletters.
- **Premium**: £29 a month or £290 a year, as shown on the membership page at the time you subscribe.

## Billing and renewal
Premium renews automatically at the end of each billing period until you cancel. You can cancel at any time from Manage billing; access continues until the end of the period you have paid for.

## Cancellation rights
You have a 14-day right to cancel a distance contract. Because Premium gives you immediate access to digital content, you are asked at checkout to agree that access starts immediately and that you lose the 14-day right once access begins.

## Content
MedTwenty Indices and trackers are editorial indicators and business information. They are not investment, financial, legal or medical advice, and not a regulated benchmark. You may share links and short quotations with attribution; you may not republish articles in full.

## Corrections
We correct factual errors promptly and note the correction on the article.`,
  },
  cookies: {
    title: "Cookie policy",
    body: `## Necessary cookies
Used for sign-in, security and remembering your cookie choice. These are always on.

| Cookie | Purpose | Duration |
| --- | --- | --- |
| mt_session | Keeps you signed in | 30 days |
| mt_consent | Stores your cookie choice | 12 months |
| mt_meter | Counts free Premium reads for visitors who are not signed in | 1 month |

## Analytics cookies
Only with your consent.

| Cookie | Purpose | Duration |
| --- | --- | --- |
| mt_anon | First-party anonymous identifier used to count returning readers | 13 months |

Change your choice at any time with **Cookie settings** in the footer.`,
  },
  accessibility: {
    title: "Accessibility statement",
    body: `We aim to meet WCAG 2.2 level AA across medtwenty.com.

## What we do
- Text and interface colours are checked for contrast.
- Every page has a skip-to-content link, visible focus states and semantic landmarks.
- Every image has alternative text.
- Forms are labelled and explain errors in text.

## Tell us about a problem
If something does not work for you, email the editor and we will respond within five working days.`,
  },
};
