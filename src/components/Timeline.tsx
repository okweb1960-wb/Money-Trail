"use client";

// Three small multiples on one shared quarterly x-axis (never a dual y-axis):
//  1. Reported lobbying per quarter (two series kept separate: in-house expenses, outside-firm income)
//  2. Federal contributions by company-affiliated PACs per quarter
//  3. Case-related lobbying entries per quarter (count)
// Decisions are numbered reference lines on every panel; the key below the chart names them.
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";

export interface TimelineRowIn {
  quarter: string;
  inHouse: number | null;
  outside: number | null;
  pac: number | null;
  caseEntries: number;
  caseEntriesPending: number;
  links: { inHouse: string[]; outside: string[]; pac: string[] };
}
export interface TimelineDecisionIn { id: string; title: string; date: string; quarter: string; sourceUrl: string }

const usdCompact = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : Math.abs(n) >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`);
const usd = (n: number | null) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));

const AXIS = { stroke: "var(--axis)", tick: { fill: "var(--muted)", fontSize: 11 }, tickLine: false } as const;

function Panel({ title, note, children, legend }: { title: string; note?: string; children: React.ReactNode; legend?: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {legend}
      </div>
      {note && <p className="text-xs text-muted">{note}</p>}
      {children}
    </div>
  );
}

function Swatch({ color, line = false, label }: { color: string; line?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      <span aria-hidden style={{ background: color, width: line ? 14 : 10, height: line ? 2 : 10, borderRadius: line ? 1 : 2, display: "inline-block" }} />
      {label}
    </span>
  );
}

function makeTooltip(kind: "spend" | "pac" | "entries", markers: Map<string, number[]>, decisions: TimelineDecisionIn[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- recharts' generic tooltip props
  return function Tip({ active, payload, label }: TooltipContentProps<any, any>) {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as TimelineRowIn;
    const ds = markers.get(String(label)) ?? [];
    return (
      <div className="rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-sm" style={{ color: "var(--ink)" }}>
        <p className="font-semibold">{label}</p>
        {kind === "spend" && (
          <>
            <p className="tabular"><Swatch color="var(--s1)" line label="" /> In-house reported expenses: {usd(row.inHouse)} <span className="text-muted">({row.links.inHouse.length} filing{row.links.inHouse.length === 1 ? "" : "s"})</span></p>
            <p className="tabular"><Swatch color="var(--s2)" line label="" /> Outside firms&apos; reported income: {usd(row.outside)} <span className="text-muted">({row.links.outside.length} filings)</span></p>
          </>
        )}
        {kind === "pac" && <p className="tabular">Federal PAC contributions: {usd(row.pac)}</p>}
        {kind === "entries" && <p className="tabular">Case-related lobbying entries: {row.caseEntries}{row.caseEntriesPending ? ` (${row.caseEntriesPending} pending review)` : ""}</p>}
        {ds.length > 0 && <p className="mt-1 text-ink-2">Decision{ds.length > 1 ? "s" : ""} this quarter: {ds.map((n) => `${n}. ${decisions[n - 1].title}`).join("; ")}</p>}
        <p className="mt-1 text-muted">Sources are listed in the table below.</p>
      </div>
    );
  };
}

export function Timeline({ rows, decisions }: { rows: TimelineRowIn[]; decisions: TimelineDecisionIn[] }) {
  const markers = new Map<string, number[]>();
  decisions.forEach((d, i) => markers.set(d.quarter, [...(markers.get(d.quarter) ?? []), i + 1]));
  const yearTicks = rows.filter((r) => r.quarter.endsWith("Q1")).map((r) => r.quarter);
  const lines = (withLabels: boolean) =>
    [...markers].map(([q, nums]) => (
      <ReferenceLine key={q} x={q} stroke="var(--ink-2)" strokeWidth={1} ifOverflow="extendDomain" label={withLabels ? { value: nums.join(","), position: "top", fill: "var(--ink)", fontSize: 11, fontWeight: 600 } : undefined} />
    ));
  const common = { data: rows, syncId: "timeline", margin: { top: 16, right: 12, bottom: 0, left: 4 } };
  const xHidden = <XAxis dataKey="quarter" scale="band" hide />;

  return (
    <figure aria-label="Timeline of lobbying, PAC contributions and case-related lobbying entries, with decisions marked">
      <Panel
        title="Reported lobbying per quarter (all issues)"
        note="Company-wide totals; not only glyphosate. The two series are shown separately because one may include the other."
        legend={<span className="flex gap-3"><Swatch color="var(--s1)" line label="In-house reported expenses" /><Swatch color="var(--s2)" line label="Outside firms' reported income" /></span>}
      >
        <div className="h-[190px]">
          <ResponsiveContainer>
            <LineChart {...common}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              {xHidden}
              <YAxis {...AXIS} tickFormatter={usdCompact} width={52} />
              <Tooltip content={makeTooltip("spend", markers, decisions)} cursor={{ stroke: "var(--axis)" }} />
              {lines(true)}
              <Line type="linear" dataKey="inHouse" stroke="var(--s1)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
              <Line type="linear" dataKey="outside" stroke="var(--s2)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Federal contributions by company-affiliated PACs per quarter" note="To federal candidates, party committees and other federal PACs. State/local recipients and transfers between the company's own PACs are excluded.">
        <div className="h-[130px]">
          <ResponsiveContainer>
            <BarChart {...common} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              {xHidden}
              <YAxis {...AXIS} tickFormatter={usdCompact} width={52} />
              <Tooltip content={makeTooltip("pac", markers, decisions)} cursor={{ fill: "var(--surface-2)" }} />
              {lines(false)}
              <Bar dataKey="pac" fill="var(--s3)" maxBarSize={12} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Case-related lobbying entries per quarter" note="LD-2 activity lines that mention glyphosate or pesticide policy (FIFRA, pesticide labeling). Screening is reviewed by a person; unreviewed entries are marked pending.">
        <div className="h-[150px]">
          <ResponsiveContainer>
            <BarChart {...common} barCategoryGap={2} margin={{ ...common.margin, bottom: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--grid)" />
              <XAxis dataKey="quarter" scale="band" {...AXIS} ticks={yearTicks} tickFormatter={(q: string) => q.slice(0, 4)} interval={0} />
              <YAxis {...AXIS} allowDecimals={false} width={52} />
              <Tooltip content={makeTooltip("entries", markers, decisions)} cursor={{ fill: "var(--surface-2)" }} />
              {lines(false)}
              <Bar dataKey="caseEntries" fill="var(--s4)" maxBarSize={12} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <figcaption className="mt-4 border-t border-line pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Decisions marked on the chart</p>
        <ol className="mt-1 space-y-1 text-sm">
          {decisions.map((d, i) => (
            <li key={d.id} className="flex flex-wrap gap-x-2">
              <span className="w-5 font-semibold tabular">{i + 1}.</span>
              <span className="tabular text-ink-2">{d.date}</span>
              <span>{d.title}</span>
              <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[13px]">source ↗</a>
            </li>
          ))}
        </ol>
      </figcaption>

      <details className="mt-4 rounded-md border border-line">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Table view: every value with its sources</summary>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-left text-xs tabular">
            <thead className="sticky top-0 bg-surface-2 text-ink-2">
              <tr><th className="px-3 py-1.5">Quarter</th><th className="px-3 py-1.5">In-house expenses</th><th className="px-3 py-1.5">Outside firms&apos; income</th><th className="px-3 py-1.5">Federal PAC contributions</th><th className="px-3 py-1.5">Case-related entries</th><th className="px-3 py-1.5">Decisions</th></tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.quarter} className="border-t border-line align-top">
                  <td className="px-3 py-1.5 font-medium">{r.quarter}</td>
                  <td className="px-3 py-1.5">{usd(r.inHouse)} {r.links.inHouse.map((u, i) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="ml-1">[{i + 1}]</a>)}</td>
                  <td className="px-3 py-1.5">{usd(r.outside)} <span className="text-muted">({r.links.outside.length} filings)</span></td>
                  <td className="px-3 py-1.5">{usd(r.pac)}</td>
                  <td className="px-3 py-1.5">{r.caseEntries}{r.caseEntriesPending ? <span className="text-muted"> ({r.caseEntriesPending} pending)</span> : null}</td>
                  <td className="px-3 py-1.5">{(markers.get(r.quarter) ?? []).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-3 py-2 text-xs text-muted">Outside-firm filings for each quarter are listed in the Investigator view&apos;s filings table. PAC contributions link to FEC filing images in the network and sources pages.</p>
      </details>
    </figure>
  );
}
