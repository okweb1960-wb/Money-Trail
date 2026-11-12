import type { FlagRow } from "@/lib/data";
import { FLAG_FOOTNOTE } from "@/lib/flags";
import { PendingBadge, RecordBadge } from "./Badges";

const fmt = (v: unknown): string => {
  if (typeof v === "number") return Number.isInteger(v) && Math.abs(v) >= 1000 ? "$" + v.toLocaleString("en-US") : String(v);
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" && x ? Object.values(x).join(" — ") : String(x))).join("; ");
  if (v && typeof v === "object") return Object.entries(v).map(([k, x]) => `${k}: ${fmt(x)}`).join(", ");
  return String(v);
};
const human = (k: string) => k.replace(/([A-Z])/g, " $1").toLowerCase();

export function FlagCard({ flag }: { flag: FlagRow }) {
  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <header className="flex flex-wrap items-center gap-2">
        <span className="rounded-sm border border-line px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-2">Worth a closer look</span>
        <h3 className="text-sm font-semibold">{flag.ruleTitle}</h3>
        {flag.pendingReview && <PendingBadge />}
      </header>
      <p className="mt-2 text-[15px] leading-relaxed">{flag.wording}</p>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div className="rounded-md bg-surface-2 p-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Observed</dt>
          {Object.entries(flag.observed).map(([k, v]) => <dd key={k} className="tabular"><span className="text-ink-2">{human(k)}:</span> {fmt(v)}</dd>)}
        </div>
        <div className="rounded-md bg-surface-2 p-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Baseline (same company)</dt>
          {Object.entries(flag.baseline).map(([k, v]) => <dd key={k} className="tabular"><span className="text-ink-2">{human(k)}:</span> {fmt(v)}</dd>)}
        </div>
      </dl>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium">Evidence ({flag.evidence.length}) <RecordBadge className="ml-1 align-middle" /></summary>
        <ul className="mt-2 space-y-1 text-sm">
          {flag.evidence.map((e) => (
            <li key={e.label + e.url}><a href={e.url} target="_blank" rel="noopener noreferrer">{e.label} ↗</a></li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">How this rule works: {flag.ruleHow}</p>
      </details>
      <p className="mt-3 text-xs text-muted">{FLAG_FOOTNOTE}</p>
    </article>
  );
}
