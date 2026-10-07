import type { Metadata } from "next";

export const metadata: Metadata = { title: "Control Room", robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-charcoal px-4 py-10">{children}</main>;
}
