"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
function writeCookie(name: string, value: string, days: number) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${days * 86400}; Path=/; SameSite=Lax${secure}`;
}

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <ul className="flex gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none]">
      {items.map((i) => {
        const active = i.href === "/" ? path === "/" : path === i.href || path.startsWith(i.href + "/");
        return (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={active ? "page" : undefined}
              className={`block px-3 py-3.5 text-[1.02rem] md:px-5 md:text-[1.1rem] ${active ? "bg-cream font-medium text-ink" : "text-[#33363d] hover:text-rust-text"}`}
            >
              {i.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function RebrandBar() {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem("mt_rebrand_dismissed") === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  if (hidden) return null;
  return (
    <div className="bg-charcoal text-white">
      <div className="wrap flex items-center justify-between gap-4 py-3 text-[0.95rem] md:text-base">
        <p>
          VanadiumNews is now MedTwenty. Same team, same standards, new name.{" "}
          <Link href="/about#rebrand" className="font-medium text-rust-light hover:underline">
            Read more
          </Link>
        </p>
        <button
          type="button"
          aria-label="Dismiss notice"
          className="p-1 text-white/70 hover:text-white"
          onClick={() => {
            try {
              localStorage.setItem("mt_rebrand_dismissed", "1");
            } catch {}
            setHidden(true);
          }}
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** Cookie consent (UK GDPR / PECR). Only necessary cookies until the reader opts in. */
export function CookieBanner() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!readCookie("mt_consent")) setOpen(true);
    const h = () => setOpen(true);
    window.addEventListener("mt:cookie-settings", h);
    return () => window.removeEventListener("mt:cookie-settings", h);
  }, []);
  if (!open) return null;
  const choose = (v: "all" | "necessary") => {
    writeCookie("mt_consent", v, 365);
    if (v === "necessary") writeCookie("mt_anon", "", 0);
    setOpen(false);
    window.dispatchEvent(new Event("mt:consent"));
  };
  return (
    <div role="dialog" aria-label="Cookie choices" className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-white shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
      <div className="wrap flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-[#33363d] md:max-w-3xl">
          We use necessary cookies to keep you signed in and to run the site. With your permission we also use a first-party analytics cookie to count returning readers.{" "}
          <Link href="/cookies" className="text-rust-text underline">
            Cookie policy
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button className="btn btn-outline btn-sm" onClick={() => choose("necessary")}>
            Necessary only
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => choose("all")}>
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}

export function CookieSettingsLink() {
  return (
    <button type="button" className="hover:text-white" onClick={() => window.dispatchEvent(new Event("mt:cookie-settings"))}>
      Cookie settings
    </button>
  );
}

/** Records a page view, only after analytics consent. */
export function PageView({ articleId }: { articleId?: number }) {
  const path = usePathname();
  useEffect(() => {
    const send = () => {
      if (readCookie("mt_consent") !== "all") return;
      let anon = readCookie("mt_anon");
      if (!anon) {
        anon = crypto.randomUUID();
        writeCookie("mt_anon", anon, 395);
      }
      fetch("/api/pv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, anon, articleId }),
        keepalive: true,
      }).catch(() => {});
    };
    send();
  }, [path, articleId]);
  return null;
}

/** Marks an anonymous premium read in the meter cookie (necessary for the paywall). */
export function MeterMark({ articleId, month }: { articleId: number; month: string }) {
  useEffect(() => {
    const raw = readCookie("mt_meter") || "";
    const [m, ids] = raw.split(":");
    const list = m === month && ids ? ids.split(",").filter(Boolean) : [];
    if (!list.includes(String(articleId))) list.push(String(articleId));
    writeCookie("mt_meter", `${month}:${list.join(",")}`, 31);
  }, [articleId, month]);
  return null;
}

export function SearchShortcut() {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        (document.getElementById("site-search") as HTMLInputElement | null)?.focus();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return null;
}

export function ConfirmButton({
  children,
  message,
  className = "btn btn-outline btn-sm",
  formAction,
  name,
  value,
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
  formAction?: (fd: FormData) => void | Promise<void>;
  name?: string;
  value?: string;
}) {
  return (
    <button
      className={className}
      formAction={formAction}
      name={name}
      value={value}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

export function Toast({ message, tone = "ok" }: { message?: string | null; tone?: "ok" | "error" }) {
  const [show, setShow] = useState(!!message);
  useEffect(() => {
    setShow(!!message);
    if (message) {
      const t = setTimeout(() => setShow(false), 5000);
      return () => clearTimeout(t);
    }
  }, [message]);
  if (!show || !message) return null;
  return (
    <div role="status" className={`fixed right-4 top-4 z-50 max-w-sm rounded-md px-4 py-3 text-sm text-white shadow-lg ${tone === "ok" ? "bg-charcoal" : "bg-down"}`}>
      {message}
    </div>
  );
}

export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  const [, start] = useTransition();
  useEffect(() => {
    const t = setInterval(() => start(() => router.refresh()), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * Forms with several submit buttons (name="op" value="publish" etc.) rely on the
 * clicked button's name/value. React's form actions don't always include the
 * submitter, so copy it into a hidden field just before submission.
 */
export function SubmitterShim() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest?.("button[name]") as HTMLButtonElement | null;
      if (!btn || !btn.form || btn.type !== "submit" || btn.disabled) return;
      const form = btn.form;
      form.querySelectorAll("input[data-submitter]").forEach((n) => n.remove());
      const h = document.createElement("input");
      h.type = "hidden";
      h.name = btn.name;
      h.value = btn.value;
      h.dataset.submitter = "1";
      form.appendChild(h);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
