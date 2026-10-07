import "server-only";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { rateLimit } from "./auth";

export function authorize(req: Request): NextResponse | null {
  const secret = process.env.INGEST_API_SECRET;
  const header = req.headers.get("authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const ok =
    !!secret &&
    secret !== "change-me" &&
    given.length === secret.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit("ingest-api", 60, 60)) return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  return null;
}

// A tiny schema validator: rejects unknown fields and checks types.
type Rule = { type: "string" | "number" | "array" | "object" | "integer"; required?: boolean; max?: number; min?: number; enum?: string[]; of?: Schema };
export type Schema = Record<string, Rule>;

export function validate(obj: unknown, schema: Schema, path = ""): string[] {
  const errs: string[] = [];
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return [`${path || "body"} must be an object`];
  const o = obj as Record<string, unknown>;
  for (const k of Object.keys(o)) if (!(k in schema)) errs.push(`${path}${k}: unknown field`);
  for (const [k, r] of Object.entries(schema)) {
    const v = o[k];
    const p = `${path}${k}`;
    if (v === undefined || v === null) {
      if (r.required) errs.push(`${p}: required`);
      continue;
    }
    if (r.type === "string") {
      if (typeof v !== "string") errs.push(`${p}: must be a string`);
      else {
        if (r.max && v.length > r.max) errs.push(`${p}: longer than ${r.max}`);
        if (r.enum && !r.enum.includes(v)) errs.push(`${p}: must be one of ${r.enum.join(", ")}`);
      }
    } else if (r.type === "number" || r.type === "integer") {
      if (typeof v !== "number" || Number.isNaN(v) || (r.type === "integer" && !Number.isInteger(v))) errs.push(`${p}: must be a ${r.type}`);
      else if ((r.min !== undefined && v < r.min) || (r.max !== undefined && v > r.max)) errs.push(`${p}: out of range`);
    } else if (r.type === "array") {
      if (!Array.isArray(v)) errs.push(`${p}: must be an array`);
      else {
        if (r.max && v.length > r.max) errs.push(`${p}: more than ${r.max} entries`);
        if (r.of) v.forEach((x, i) => errs.push(...validate(x, r.of!, `${p}[${i}].`)));
        else v.forEach((x, i) => typeof x !== "string" && errs.push(`${p}[${i}]: must be a string`));
      }
    } else if (r.type === "object") {
      if (r.of) errs.push(...validate(v, r.of, `${p}.`));
      else if (typeof v !== "object") errs.push(`${p}: must be an object`);
    }
  }
  return errs;
}

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > 2_000_000) throw new Error("Body too large");
  return JSON.parse(text);
}

/** Similarity of two names using trigrams (Jaccard), 0..1. */
export function trigramSimilarity(a: string, b: string): number {
  const grams = (s: string) => {
    const t = `  ${s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim()} `;
    const set = new Set<string>();
    for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3));
    return set;
  };
  const A = grams(a);
  const B = grams(b);
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter || 1);
}
