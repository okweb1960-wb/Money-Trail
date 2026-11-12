// RECORD vs CLAIM labels. Distinguished by shape, icon and words — not by party-coded colors.

export function RecordBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold tracking-wide ${className}`} style={{ background: "var(--record-bg)", color: "var(--record-ink)", borderColor: "var(--record-ink)" }} title="Verified in a primary public source">
      <svg aria-hidden width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5.2 4 7.6 8.6 2.4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
      RECORD
    </span>
  );
}

export function ClaimBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11px] font-semibold tracking-wide ${className}`} style={{ background: "var(--claim-bg)", color: "var(--claim-ink)", borderColor: "var(--claim-ink)" }} title="An allegation by a named person; not verified by this app">
      <svg aria-hidden width="10" height="10" viewBox="0 0 10 10"><path d="M1 6.5V4a2 2 0 0 1 2-2M5.5 6.5V4a2 2 0 0 1 2-2" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
      CLAIM
    </span>
  );
}

export function PendingBadge() {
  return (
    <span className="inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium" style={{ color: "var(--pending-ink)", borderColor: "var(--border)" }} title="Classified by a screening rule; a person has not reviewed it yet (data/review/*.csv)">
      pending review
    </span>
  );
}

export function SourceLink({ href, children, retrievedAt }: { href: string; children?: React.ReactNode; retrievedAt?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-[13px]" title={retrievedAt ? `Retrieved ${retrievedAt.slice(0, 10)}` : undefined}>
      {children ?? "source"}
      <span aria-hidden> ↗</span>
    </a>
  );
}
