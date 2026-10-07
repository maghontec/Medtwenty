import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { getSettings, appUrl } from "@/lib/settings";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif", display: "swap", weight: ["400", "600", "700"] });

export async function generateMetadata(): Promise<Metadata> {
  const s = getSettings();
  return {
    metadataBase: new URL(process.env.NODE_ENV === "production" ? "https://medtwenty.com" : appUrl()),
    title: { default: `MedTwenty | ${s.descriptor}`, template: "%s | MedTwenty" },
    description: s.meta_description,
    openGraph: { siteName: "MedTwenty", type: "website", locale: "en_GB" },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = { themeColor: "#1f2228", width: "device-width", initialScale: 1 };

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${inter.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
