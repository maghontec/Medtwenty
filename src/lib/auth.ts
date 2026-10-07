import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { get, run, all } from "./db";

export const SUPER_ADMIN_EMAIL = "maghontec@gmail.com";
const MEMBER_COOKIE = "mt_session";
const STAFF_COOKIE = "mt_staff";
const DAY = 86400_000;

export type User = {
  id: number;
  email: string;
  name: string | null;
  email_confirmed_at: string | null;
  stripe_customer_id: string | null;
  last_seen_at: string | null;
  previous_seen_at: string | null;
  created_at: string;
};

export type Role = "super_admin" | "editor" | "contributor";
export type Staff = User & { roles: Role[] };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [, saltHex, hashHex] = stored.split("$");
  if (!saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return expected.length === hash.length && crypto.timingSafeEqual(expected, hash);
}

export function token(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function findUserByEmail(email: string) {
  return get<User & { password_hash: string | null }>("SELECT * FROM users WHERE email = ?", email.trim());
}

export function createUser(email: string, password: string | null, name?: string | null, source = "signup"): number {
  const r = run(
    "INSERT INTO users (email, name, password_hash, confirm_token, source) VALUES (?, ?, ?, ?, ?)",
    email.trim().toLowerCase(),
    name || null,
    password ? hashPassword(password) : null,
    token(24),
    source,
  );
  return r.lastId;
}

async function setCookie(name: string, value: string, maxAgeDays: number) {
  const jar = await cookies();
  jar.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.APP_URL || "").startsWith("https://"),
    path: "/",
    maxAge: maxAgeDays * 86400,
  });
}

export async function startSession(userId: number, kind: "member" | "staff" = "member") {
  const t = token();
  const days = kind === "staff" ? 1 : 30;
  run("INSERT INTO sessions (token, user_id, kind, expires_at) VALUES (?, ?, ?, ?)", t, userId, kind, new Date(Date.now() + days * DAY).toISOString());
  await setCookie(kind === "staff" ? STAFF_COOKIE : MEMBER_COOKIE, t, days);
}

export async function endSession(kind: "member" | "staff" = "member") {
  const jar = await cookies();
  const name = kind === "staff" ? STAFF_COOKIE : MEMBER_COOKIE;
  const t = jar.get(name)?.value;
  if (t) run("DELETE FROM sessions WHERE token = ?", t);
  jar.delete(name);
}

async function userFromCookie(name: string, kind: string): Promise<User | null> {
  const jar = await cookies();
  const t = jar.get(name)?.value;
  if (!t) return null;
  const u = get<User>(
    `SELECT u.id, u.email, u.name, u.email_confirmed_at, u.stripe_customer_id, u.last_seen_at, u.previous_seen_at, u.created_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.kind = ? AND s.expires_at > ?`,
    t,
    kind,
    new Date().toISOString(),
  );
  return u ?? null;
}

export async function currentUser(): Promise<User | null> {
  return userFromCookie(MEMBER_COOKIE, "member");
}

export function rolesFor(userId: number): Role[] {
  return all<{ role: Role }>("SELECT role FROM user_roles WHERE user_id = ?", userId).map((r) => r.role);
}

/** Staff user from the separate Control Room session, with roles. */
export async function currentStaffSession(): Promise<Staff | null> {
  const u = await userFromCookie(STAFF_COOKIE, "staff");
  if (!u) return null;
  return { ...u, roles: rolesFor(u.id) };
}

/** Require a staff session with at least one role. Redirects otherwise. */
export async function requireStaff(allowed?: Role[]): Promise<Staff> {
  const s = await currentStaffSession();
  if (!s) redirect("/admin/login");
  if (s.roles.length === 0) redirect("/admin/denied");
  if (allowed && !s.roles.some((r) => allowed.includes(r))) redirect("/admin/denied");
  return s;
}

/** Same check, for server actions and route handlers: throws instead of redirecting. */
export async function assertStaff(allowed?: Role[]): Promise<Staff> {
  const s = await currentStaffSession();
  if (!s || s.roles.length === 0) throw new Error("Access denied");
  if (allowed && !s.roles.some((r) => allowed.includes(r))) throw new Error("Access denied");
  return s;
}

export function claimSuperAdmin(user: User): boolean {
  if (user.email.toLowerCase() !== SUPER_ADMIN_EMAIL) return false;
  run("INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'super_admin')", user.id);
  return true;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") || h.get("x-real-ip") || "local").split(",")[0].trim();
}

/** Fixed-window rate limit stored in the database. Returns true when allowed. */
export function rateLimit(key: string, limit: number, windowSeconds: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const row = get<{ count: number; window_start: number }>("SELECT count, window_start FROM rate_limits WHERE key = ?", key);
  if (!row || now - row.window_start >= windowSeconds) {
    run("INSERT OR REPLACE INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)", key, now);
    return true;
  }
  if (row.count >= limit) return false;
  run("UPDATE rate_limits SET count = count + 1 WHERE key = ?", key);
  return true;
}

/** Only allow same-site relative redirects. */
export function safeRedirect(target: string | null | undefined, fallback = "/"): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) return fallback;
  return target;
}
