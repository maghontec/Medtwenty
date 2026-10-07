"use server";

import { redirect } from "next/navigation";
import { clientIp, currentUser, rateLimit } from "@/lib/auth";
import { subscribe } from "@/lib/newsletters";
import { run } from "@/lib/db";

export type FormState = { ok?: boolean; message?: string } | null;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function subscribeAction(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const slugs = fd.getAll("newsletter").map(String);
  const source = String(fd.get("source") || "site");
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Enter a valid email address." };
  if (slugs.length === 0) return { ok: false, message: "Choose at least one newsletter." };
  if (!fd.get("consent")) return { ok: false, message: "Tick the box to confirm you would like to receive these emails." };
  const ip = await clientIp();
  if (!rateLimit(`newsletter:${ip}`, 10, 3600)) return { ok: false, message: "Too many attempts. Please try again later." };
  const user = await currentUser();
  const r = await subscribe(email, slugs, source, user);
  if (r.confirmed) return { ok: true, message: "You're subscribed." };
  if (r.pending) return { ok: true, message: "Check your inbox: we've sent a link to confirm your subscription." };
  return { ok: true, message: "You're already subscribed." };
}

export async function contactAction(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") || "").trim();
  const message = String(fd.get("message") || "").trim();
  const name = String(fd.get("name") || "").trim();
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Enter a valid email address." };
  if (message.length < 10) return { ok: false, message: "Please write a little more so we can help." };
  const ip = await clientIp();
  if (!rateLimit(`contact:${ip}`, 5, 3600)) return { ok: false, message: "Too many messages. Please try again later." };
  run("INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)", name, email, message.slice(0, 5000));
  return { ok: true, message: "Thanks. The editor will reply by email." };
}

export async function searchRedirect(fd: FormData) {
  redirect(`/search?q=${encodeURIComponent(String(fd.get("q") || ""))}`);
}
