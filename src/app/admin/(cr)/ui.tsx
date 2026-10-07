import { Toast } from "@/components/client";

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl font-bold">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Flash({ sp }: { sp: { msg?: string; err?: string } }) {
  return (
    <>
      {sp.err && <p role="alert" className="mb-4 rounded-md bg-[#f6e2e0] px-4 py-3 text-sm text-down">{sp.err}</p>}
      <Toast message={sp.msg} />
    </>
  );
}

export function Panel({ title, children, className = "", actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="eyebrow text-muted">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="eyebrow text-[0.65rem] text-muted">{label}</p>
      <p className="mt-2 font-serif text-3xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-[#eee] text-[#444]",
  review: "bg-[#fdf0d5] text-[#7a5200]",
  approved: "bg-[#e3eef9] text-[#1f4f82]",
  scheduled: "bg-[#ece6f7] text-[#4a3a80]",
  published: "bg-[#e3efe6] text-up",
  rejected: "bg-[#f6e2e0] text-down",
  retracted: "bg-[#f6e2e0] text-down",
  sent: "bg-[#e3efe6] text-up",
  canceled: "bg-[#eee] text-[#444]",
  sending: "bg-[#fdf0d5] text-[#7a5200]",
};

export function Badge({ s }: { s: string }) {
  return <span className={`eyebrow rounded px-2 py-0.5 text-[0.62rem] ${STATUS_COLORS[s] || "bg-[#eee] text-[#444]"}`}>{s}</span>;
}
