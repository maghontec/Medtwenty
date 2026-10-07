"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ nav }: { nav: { group: string; items: { href: string; label: string }[] }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Control Room" className="flex gap-4 overflow-x-auto px-3 pb-4 md:block md:space-y-5 md:overflow-visible">
      {nav.map((g) => (
        <div key={g.group} className="shrink-0">
          <p className="eyebrow mb-1.5 hidden px-2 text-[0.62rem] text-white/40 md:block">{g.group}</p>
          <ul className="flex gap-1 md:block md:space-y-0.5">
            {g.items.map((i) => {
              const active = i.href === "/admin" ? path === "/admin" : path === i.href || path.startsWith(i.href + "/");
              return (
                <li key={i.href}>
                  <Link href={i.href} aria-current={active ? "page" : undefined} className={`block whitespace-nowrap rounded px-2 py-1.5 text-sm ${active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"}`}>
                    {i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
