"use client";

import { useActionState } from "react";
import { contactAction, type FormState } from "@/app/actions/public";

export function ContactForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(contactAction, null);
  if (state?.ok) return <p role="status" className="rounded-md bg-cream p-5 font-medium">{state.message}</p>;
  return (
    <form action={action} className="space-y-5">
      <div>
        <label className="label" htmlFor="c-name">Name (optional)</label>
        <input id="c-name" name="name" className="input" autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="c-email">Email</label>
        <input id="c-email" name="email" type="email" required className="input" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="c-msg">Message</label>
        <textarea id="c-msg" name="message" required rows={6} className="input" />
      </div>
      {state?.message && <p role="alert" className="text-sm text-down">{state.message}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : "Send"}</button>
    </form>
  );
}
