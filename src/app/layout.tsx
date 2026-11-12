import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: { default: "Money Trail", template: "%s · Money Trail" },
  description: "A nonpartisan view of how lobbying and political money line up in time with government decisions, from public records only.",
};

const NAV = [
  { href: "/cases/glyphosate", label: "Glyphosate case" },
  { href: "/cases/glyphosate/network", label: "Network" },
  { href: "/cases/glyphosate/revolving-door", label: "Revolving door" },
  { href: "/cases/glyphosate/claims", label: "Claims" },
  { href: "/methodology", label: "Methodology" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="font-semibold text-ink no-underline">Money Trail</Link>
            <nav aria-label="Main" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-ink-2">{n.label}</Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
