"use server";

import { redirect } from "next/navigation";
import {
  claimSuperAdmin,
  clientIp,
  createUser,
  currentStaffSession,
  currentUser,
  endSession,
  findUserByEmail,
  hashPassword,
  rateLimit,
  rolesFor,
  safeRedirect,
  startSession,
  token,
  verifyPassword,
} from "@/lib/auth";
import { get, run } from "@/lib/db";
import { sendConfirmEmail, sendResetEmail, sendWelcomeEmail } from "@/lib/email";
import { entitlementFor } from "@/lib/entitlements";
import { audit } from "@/lib/audit";

export type AuthState = { error?: string; message?: string } | null;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function landing(userId: number, redirectTo: string | null) {
  if (redirectTo) return safeRedirect(redirectTo);
  const u = get<{ id: number; email: string }>("SELECT * FROM users WHERE id = ?", userId);
  return entitlementFor(u as never).premium ? "/premium-dashboard" : "/dashboard";
}

export async function signupAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const redirectTo = String(fd.get("redirect") || "") || null;
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 10) return { error: "Use a password of at least 10 characters." };
  if (!fd.get("terms")) return { error: "Please accept the terms and privacy notice." };
  if (!rateLimit(`signup:${await clientIp()}`, 10, 3600)) return { error: "Too many attempts. Please try again later." };
  if (findUserByEmail(email)) return { error: "An account with this email already exists. Sign in instead." };
  const id = createUser(email, password, String(fd.get("name") || "") || null);
  const u = get<{ confirm_token: string }>("SELECT confirm_token FROM users WHERE id = ?", id)!;
  await sendConfirmEmail(email, u.confirm_token);
  await sendWelcomeEmail(email, false);
  await startSession(id, "member");
  redirect(landing(id, redirectTo));
}

export async function loginAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const redirectTo = String(fd.get("redirect") || "") || null;
  const ip = await clientIp();
  if (!rateLimit(`login:${ip}`, 20, 900) || !rateLimit(`login:${email}`, 10, 900)) return { error: "Too many attempts. Wait 15 minutes and try again." };
  const u = findUserByEmail(email);
  if (!u || !verifyPassword(password, u.password_hash)) return { error: "Email or password is incorrect." };
  await startSession(u.id, "member");
  redirect(landing(u.id, redirectTo));
}

export async function logoutAction() {
  await endSession("member");
  redirect("/");
}

export async function forgotAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  if (!rateLimit(`forgot:${await clientIp()}`, 5, 3600)) return { error: "Too many attempts. Please try again later." };
  const u = findUserByEmail(email);
  if (u) {
    const t = token();
    run("UPDATE users SET reset_token = ?, reset_expires_at = ? WHERE id = ?", t, new Date(Date.now() + 3600_000).toISOString(), u.id);
    await sendResetEmail(email, t);
  }
  return { message: "If an account exists for that email, we've sent a link to reset the password." };
}

export async function resetAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const t = String(fd.get("token") || "");
  const password = String(fd.get("password") || "");
  if (password.length < 10) return { error: "Use a password of at least 10 characters." };
  const u = get<{ id: number }>("SELECT id FROM users WHERE reset_token = ? AND reset_expires_at > ?", t, new Date().toISOString());
  if (!u) return { error: "This reset link has expired. Request a new one." };
  run("UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL, email_confirmed_at = COALESCE(email_confirmed_at, ?) WHERE id = ?", hashPassword(password), new Date().toISOString(), u.id);
  run("DELETE FROM sessions WHERE user_id = ?", u.id);
  await startSession(u.id, "member");
  redirect(landing(u.id, null));
}

export async function resendConfirmAction() {
  const user = await currentUser();
  if (!user || user.email_confirmed_at) return;
  if (!rateLimit(`confirm:${user.id}`, 3, 3600)) return;
  let t = get<{ confirm_token: string | null }>("SELECT confirm_token FROM users WHERE id = ?", user.id)?.confirm_token;
  if (!t) {
    t = token(24);
    run("UPDATE users SET confirm_token = ? WHERE id = ?", t, user.id);
  }
  await sendConfirmEmail(user.email, t);
}

// ---------- Control Room sign-in (separate from member sign-in) ----------

export async function staffLoginAction(_: AuthState, fd: FormData): Promise<AuthState> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const ip = await clientIp();
  if (!rateLimit(`staff-login:${ip}`, 10, 900)) return { error: "Too many attempts. Wait 15 minutes and try again." };
  let u = findUserByEmail(email);
  // First run: the owner can create their staff credentials here, then claim super admin.
  if (!u && email === "maghontec@gmail.com" && fd.get("create")) {
    if (password.length < 12) return { error: "Use a password of at least 12 characters." };
    createUser(email, password, null, "staff");
    u = findUserByEmail(email);
  }
  if (!u || !verifyPassword(password, u.password_hash)) return { error: "Email or password is incorrect." };
  await startSession(u.id, "staff");
  audit({ id: u.id, email: u.email }, "staff_sign_in", "user", u.id);
  redirect(rolesFor(u.id).length ? "/admin" : "/admin/denied");
}

export async function staffLogoutAction() {
  await endSession("staff");
  redirect("/admin/login");
}

export async function claimSuperAdminAction() {
  const s = await currentStaffSession();
  if (!s) redirect("/admin/login");
  if (claimSuperAdmin(s)) {
    audit({ id: s.id, email: s.email }, "claim_super_admin", "user", s.id, null, { role: "super_admin" });
    redirect("/admin");
  }
  redirect("/admin/denied");
}
