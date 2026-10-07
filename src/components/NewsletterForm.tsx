"use client";

import { useActionState } from "react";
import { subscribeAction, type FormState } from "@/app/actions/public";

type N = { slug: string; name: string; description: string | null; cadence: string | null; is_premium: number };

export function NewsletterForm({
  newsletters,
  source,
  defaultEmail = "",
  dark = false,
  premium = false,
}: {
  newsletters: N[];
  source: string;
  defaultEmail?: string;
  dark?: boolean;
  premium?: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(subscribeAction, null);
  const muted = dark ? "text-white/70" : "text-muted";
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="source" value={source} />
      <fieldset>
        <legend className="sr-only">Newsletters</legend>
        <div className="grid gap-3 md:grid-cols-3">
          {newsletters.map((n) => {
            const locked = !!n.is_premium && !premium;
            return (
              <label
                key={n.slug}
                className={`flex cursor-pointer gap-3 rounded-lg border p-4 ${dark ? "border-white/15 bg-charcoal-2" : "border-line bg-white"} ${locked ? "opacity-70" : ""}`}
              >
                <input type="checkbox" name="newsletter" value={n.slug} defaultChecked={!n.is_premium} disabled={locked} className="mt-1 h-4 w-4 accent-[#a64f1c]" />
                <span>
                  <span className="block font-serif text-lg font-semibold">{n.name}</span>
                  <span className={`block text-sm ${muted}`}>{n.cadence}</span>
                  {n.description && <span className={`mt-1 block text-sm ${muted}`}>{n.description}</span>}
                  {locked && <span className={`mt-1 block text-xs font-semibold ${dark ? "text-rust-light" : "text-rust-text"}`}>Premium members only</span>}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={`nl-email-${source}`} className="sr-only">
          Email address
        </label>
        <input id={`nl-email-${source}`} name="email" type="email" required autoComplete="email" defaultValue={defaultEmail} placeholder="you@company.com" className="input h-12 sm:max-w-md" />
        <button className="btn btn-primary h-12 px-6" disabled={pending}>
          {pending ? "Subscribing…" : "Subscribe"}
        </button>
      </div>
      <label className={`flex gap-2 text-sm ${muted}`}>
        <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 accent-[#a64f1c]" />
        <span>I would like to receive the newsletters I have ticked. I can unsubscribe at any time with one click.</span>
      </label>
      {state?.message && (
        <p role="status" className={`text-sm font-medium ${state.ok ? (dark ? "text-rust-light" : "text-up") : "text-down"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
