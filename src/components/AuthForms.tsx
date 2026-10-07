"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotAction, loginAction, resetAction, signupAction, staffLoginAction, type AuthState } from "@/app/actions/auth";

function Err({ s }: { s: AuthState }) {
  if (!s) return null;
  if (s.error) return <p role="alert" className="rounded-md bg-[#f6e2e0] px-3 py-2 text-sm text-down">{s.error}</p>;
  if (s.message) return <p role="status" className="rounded-md bg-cream px-3 py-2 text-sm">{s.message}</p>;
  return null;
}

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [s, action, pending] = useActionState<AuthState, FormData>(loginAction, null);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="redirect" value={redirectTo || ""} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <div className="flex justify-between">
          <label className="label" htmlFor="password">Password</label>
          <Link href="/forgot" className="text-sm text-rust-text underline">Forgotten password?</Link>
        </div>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
      </div>
      <Err s={s} />
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

export function SignupForm({ redirectTo }: { redirectTo?: string }) {
  const [s, action, pending] = useActionState<AuthState, FormData>(signupAction, null);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="redirect" value={redirectTo || ""} />
      <div>
        <label className="label" htmlFor="name">Name (optional)</label>
        <input id="name" name="name" autoComplete="name" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className="input" aria-describedby="pw-help" />
        <p id="pw-help" className="mt-1 text-xs text-muted">At least 10 characters.</p>
      </div>
      <label className="flex gap-2 text-sm">
        <input type="checkbox" name="terms" required className="mt-0.5 h-4 w-4 accent-[#a64f1c]" />
        <span>
          I accept the <Link href="/terms" className="underline">terms</Link> and have read the <Link href="/privacy" className="underline">privacy notice</Link>.
        </span>
      </label>
      <Err s={s} />
      <button className="btn btn-primary w-full" disabled={pending}>{pending ? "Creating account…" : "Create free account"}</button>
    </form>
  );
}

export function ForgotForm() {
  const [s, action, pending] = useActionState<AuthState, FormData>(forgotAction, null);
  return (
    <form action={action} className="space-y-5">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="input" />
      </div>
      <Err s={s} />
      <button className="btn btn-primary w-full" disabled={pending}>Send reset link</button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [s, action, pending] = useActionState<AuthState, FormData>(resetAction, null);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className="input" />
      </div>
      <Err s={s} />
      <button className="btn btn-primary w-full" disabled={pending}>Set new password</button>
    </form>
  );
}

export function StaffLoginForm() {
  const [s, action, pending] = useActionState<AuthState, FormData>(staffLoginAction, null);
  return (
    <form action={action} className="space-y-5">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="username" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
      </div>
      <label className="flex gap-2 text-sm text-muted">
        <input type="checkbox" name="create" className="mt-0.5 h-4 w-4" />
        <span>First sign-in for the owner account: create these credentials</span>
      </label>
      <Err s={s} />
      <button className="btn btn-dark w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
