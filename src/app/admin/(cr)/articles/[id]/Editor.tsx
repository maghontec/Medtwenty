"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveArticleAction, articleStatusAction } from "@/app/actions/admin";
import { renderMarkdown } from "@/lib/markdown";

type Fields = {
  headline: string;
  standfirst: string;
  body: string;
  why_it_matters: string;
  source_outlet: string;
  source_url: string;
  content_type: string;
  category_id: string;
  topics: string;
  is_premium: boolean;
  is_editors_pick: boolean;
  seo_title: string;
  seo_description: string;
  slug: string;
  editorial_minutes: number;
  hero_image_url: string;
  hero_alt: string;
  author_name: string;
  send_daily: boolean;
};

const HOUSE_STYLE =
  "Editorial still life photograph, warm golden-hour light, cream and rust palette, shallow depth of field, a single symbolic object on a wooden or stone surface, no people, no faces, no text, no logos.";

export function Editor({
  id,
  status,
  initial,
  categories,
  library,
  canPublish,
  checklist,
  publicUrl,
}: {
  id: number;
  status: string;
  initial: Fields;
  categories: { id: number; name: string }[];
  library: string[];
  canPublish: boolean;
  checklist: { label: string; ok: boolean }[];
  publicUrl: string;
}) {
  const [f, setF] = useState<Fields>(initial);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [seconds, setSeconds] = useState(0);
  const latest = useRef(f);
  latest.current = f;
  const formRef = useRef<HTMLFormElement>(null);

  // Editorial timer: counts while the editor is open and visible.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);
  const minutes = initial.editorial_minutes + Math.floor(seconds / 60);
  useEffect(() => {
    if (seconds > 0 && seconds % 60 === 0) {
      setF((x) => ({ ...x, editorial_minutes: x.editorial_minutes + 1 }));
      setDirty(true);
    }
  }, [seconds]);

  const save = useCallback(
    async (version = false) => {
      const d = latest.current;
      const r = await saveArticleAction(
        id,
        {
          ...d,
          category_id: d.category_id || null,
          is_premium: d.is_premium,
          is_editors_pick: d.is_editors_pick,
          send_daily: d.send_daily,
        },
        version,
      );
      if (r.ok) {
        setSaved(new Date().toLocaleTimeString("en-GB"));
        setDirty(false);
        setErr(null);
        if (r.slug && r.slug !== d.slug) setF((x) => ({ ...x, slug: r.slug! }));
      } else setErr(r.error || "Save failed");
      return r.ok;
    },
    [id],
  );

  // Autosave every 10 seconds when something changed.
  useEffect(() => {
    const t = setInterval(() => {
      if (dirty) save(false);
    }, 10_000);
    return () => clearInterval(t);
  }, [dirty, save]);

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };

  const preview = useMemo(() => (tab === "preview" ? renderMarkdown(f.body) : ""), [tab, f.body]);
  const seoTitle = f.seo_title || f.headline;
  const seoDesc = f.seo_description || f.standfirst;

  async function statusOp(op: string, extra?: Record<string, string>) {
    if (!(await save(true))) return;
    const form = formRef.current!;
    (form.elements.namedItem("op") as HTMLInputElement).value = op;
    for (const [k, v] of Object.entries(extra || {})) (form.elements.namedItem(k) as HTMLInputElement).value = v;
    form.requestSubmit();
  }

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-cream-2/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <span className="text-xs text-muted" aria-live="polite">
          {err ? <span className="text-down">{err}</span> : dirty ? "Unsaved changes" : saved ? `Saved ${saved}` : "Autosaves every 10 seconds"}
        </span>
        <span className="text-xs text-muted">· {minutes} min on this piece</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => save(true)}>Save version</button>
          <a href={`${publicUrl}?preview=1`} target="_blank" className="btn btn-outline btn-sm" rel="noreferrer">Open preview</a>
          {status === "draft" && <button type="button" className="btn btn-outline btn-sm" onClick={() => statusOp("review")}>Send to review</button>}
          {canPublish && status !== "published" && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => statusOp("publish")} disabled={checklist.some((c) => !c.ok)} title={checklist.some((c) => !c.ok) ? "Complete the checklist first" : undefined}>
              Publish now
            </button>
          )}
        </div>
      </div>

      <form ref={formRef} action={articleStatusAction} className="hidden">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="op" />
        <input type="hidden" name="send_daily_present" value="1" />
        <input type="hidden" name="send_daily" value={f.send_daily ? "1" : "0"} />
      </form>

      <div>
        <label className="label" htmlFor="headline">Headline</label>
        <input id="headline" className="input font-serif text-xl font-semibold" value={f.headline} onChange={(e) => set("headline", e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="standfirst">Standfirst</label>
        <textarea id="standfirst" rows={2} className="input" value={f.standfirst} onChange={(e) => set("standfirst", e.target.value)} />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="label mb-0">Body (Markdown: ## headings, - lists, &gt; quotes, | tables |, [links](https://…))</span>
          <div className="flex rounded border border-line text-xs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "write"} className={`px-3 py-1 ${tab === "write" ? "bg-charcoal text-white" : ""}`} onClick={() => setTab("write")}>Write</button>
            <button type="button" role="tab" aria-selected={tab === "preview"} className={`px-3 py-1 ${tab === "preview" ? "bg-charcoal text-white" : ""}`} onClick={() => setTab("preview")}>Preview</button>
          </div>
        </div>
        {tab === "write" ? (
          <textarea aria-label="Body" rows={18} className="input font-mono text-sm leading-relaxed" value={f.body} onChange={(e) => set("body", e.target.value)} />
        ) : (
          <div className="card min-h-[24rem] p-6">
            <h1 className="font-serif text-3xl font-bold">{f.headline}</h1>
            {f.standfirst && <p className="mt-3 text-lg text-[#3b3e45]">{f.standfirst}</p>}
            <div className="prose-mt mt-6" dangerouslySetInnerHTML={{ __html: preview }} />
            {f.why_it_matters && (
              <aside className="mt-8 border-l-4 border-rust bg-cream-2 p-5">
                <p className="eyebrow text-rust-text">Why it matters</p>
                <p className="mt-2 font-serif text-lg">{f.why_it_matters}</p>
              </aside>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="label" htmlFor="why">Why it matters {f.content_type === "story" && <span className="text-down">(required for stories)</span>}</label>
        <textarea id="why" rows={3} className="input" value={f.why_it_matters} onChange={(e) => set("why_it_matters", e.target.value)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="outlet">Source outlet</label>
          <input id="outlet" className="input" value={f.source_outlet} onChange={(e) => set("source_outlet", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="srcurl">Source URL</label>
          <input id="srcurl" type="url" className="input" value={f.source_url} onChange={(e) => set("source_url", e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="label" htmlFor="ctype">Content type</label>
          <select id="ctype" className="input" value={f.content_type} onChange={(e) => set("content_type", e.target.value)}>
            <option value="story">Daily story</option>
            <option value="analysis">Monthly analysis</option>
            <option value="briefing">Weekly briefing</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cat">Category</label>
          <select id="cat" className="input" value={f.category_id} onChange={(e) => set("category_id", e.target.value)}>
            <option value="">Choose…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="topics">Topics (comma separated)</label>
          <input id="topics" className="input" value={f.topics} onChange={(e) => set("topics", e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.is_premium} onChange={(e) => set("is_premium", e.target.checked)} className="h-4 w-4 accent-[#a64f1c]" /> Premium</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.is_editors_pick} onChange={(e) => set("is_editors_pick", e.target.checked)} className="h-4 w-4 accent-[#a64f1c]" /> Editors&apos; pick</label>
        {f.content_type === "story" && (
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.send_daily} onChange={(e) => set("send_daily", e.target.checked)} className="h-4 w-4 accent-[#a64f1c]" /> Send to The Daily Story list on publish</label>
        )}
      </div>

      <fieldset className="card space-y-4 p-5">
        <legend className="eyebrow px-1 text-muted">SEO</legend>
        <div>
          <label className="label" htmlFor="seot">SEO title <span className={`font-normal ${seoTitle.length > 60 ? "text-down" : "text-muted"}`}>{seoTitle.length}/60</span></label>
          <input id="seot" className="input" value={f.seo_title} placeholder={f.headline} onChange={(e) => set("seo_title", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="seod">SEO description <span className={`font-normal ${seoDesc.length > 155 ? "text-down" : "text-muted"}`}>{seoDesc.length}/155</span></label>
          <textarea id="seod" rows={2} className="input" value={f.seo_description} placeholder={f.standfirst} onChange={(e) => set("seo_description", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="slug">Slug</label>
          <input id="slug" className="input font-mono text-sm" value={f.slug} onChange={(e) => set("slug", e.target.value)} />
        </div>
        <div className="rounded border border-line bg-white p-4" aria-label="Search snippet preview">
          <p className="text-xs text-[#1e7e34]">medtwenty.com › news › {f.slug}</p>
          <p className="text-lg text-[#1a0dab]">{seoTitle.slice(0, 60)} | MedTwenty</p>
          <p className="text-sm text-[#4d5156]">{seoDesc.slice(0, 155)}</p>
        </div>
      </fieldset>

      <fieldset className="card space-y-4 p-5">
        <legend className="eyebrow px-1 text-muted">Hero image</legend>
        {f.hero_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.hero_image_url} alt={f.hero_alt} className="aspect-[16/9] w-full max-w-md rounded object-cover" />
        )}
        <div className="flex flex-wrap gap-2">
          {library.map((src) => (
            <button key={src} type="button" onClick={() => set("hero_image_url", src)} className={`h-16 w-24 overflow-hidden rounded border-2 ${f.hero_image_url === src ? "border-rust" : "border-transparent"}`} aria-label={`Use ${src}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
          {f.hero_image_url && <button type="button" className="btn btn-outline btn-sm" onClick={() => set("hero_image_url", "")}>Remove image</button>}
        </div>
        <div>
          <label className="label" htmlFor="heroUrl">Licensed image URL (https:// or /images/…)</label>
          <input id="heroUrl" className="input" value={f.hero_image_url} onChange={(e) => set("hero_image_url", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="alt">Alt text {f.hero_image_url && <span className="text-down">(required)</span>}</label>
          <input id="alt" className="input" value={f.hero_alt} onChange={(e) => set("hero_alt", e.target.value)} />
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Generate image: house-style prompt</summary>
          <p className="mt-2 text-muted">Paste into your image tool, then add the result to <code>public/images/stories</code> or paste its URL above.</p>
          <p className="mt-2 rounded bg-cream p-3">{HOUSE_STYLE} Subject: {f.headline}</p>
        </details>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="author">Byline</label>
          <input id="author" className="input" value={f.author_name} onChange={(e) => set("author_name", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="mins">Editorial minutes (timer adds while open)</label>
          <input id="mins" type="number" min={0} className="input" value={f.editorial_minutes} onChange={(e) => set("editorial_minutes", Number(e.target.value))} />
        </div>
      </div>
    </div>
  );
}
