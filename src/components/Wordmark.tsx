import Link from "next/link";

export function Wordmark({ size = "lg", dark = false, href = "/" }: { size?: "sm" | "md" | "lg"; dark?: boolean; href?: string }) {
  const cls = size === "lg" ? "text-[2.1rem] md:text-[2.6rem]" : size === "md" ? "text-2xl" : "text-xl";
  return (
    <Link href={href} className={`font-serif font-bold leading-none tracking-tight ${cls} ${dark ? "text-white" : "text-ink"}`} aria-label="MedTwenty home">
      Med<span className={dark ? "text-rust-light" : "text-rust"}>Twenty</span>
    </Link>
  );
}

export function LockIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

export function PremiumTag({ className = "" }: { className?: string }) {
  return (
    <span className={`tag-premium ${className}`}>
      <LockIcon /> Premium
    </span>
  );
}

export function Arrow() {
  return <span aria-hidden="true">→</span>;
}
