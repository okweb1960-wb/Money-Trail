import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-ink-2 sm:grid-cols-4">
        <div>
          <p className="font-semibold text-ink">Correlation is not causation.</p>
          <p className="mt-1">This site shows when things happened and how they are connected in public records. It does not claim that money caused any decision.</p>
        </div>
        <div>
          <p className="font-semibold text-ink">Nonpartisan</p>
          <p className="mt-1">The same rules, wording and colors apply to every company, party and administration. No party labels or party colors are used.</p>
        </div>
        <div>
          <p className="font-semibold text-ink">Public records only</p>
          <p className="mt-1">Senate lobbying disclosures, FEC filings, the Federal Register and the Supreme Court docket. Every fact links to its source.</p>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Footer">
          <Link href="/methodology">Methodology</Link>
          <Link href="/methodology#nonpartisan">Nonpartisan statement</Link>
          <Link href="/sources">Data sources</Link>
        </nav>
      </div>
    </footer>
  );
}
