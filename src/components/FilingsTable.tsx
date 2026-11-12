"use client";

import { useMemo, useState } from "react";

export interface FilingRowIn { id: string; quarter: string; registrant: string; client: string; inHouse: boolean; amount: number | null; sourceUrl: string; retrievedAt: string }

const usd = (n: number | null) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));

export function FilingsTable({ rows }: { rows: FilingRowIn[] }) {
  const years = useMemo(() => [...new Set(rows.map((r) => r.quarter.slice(0, 4)))].sort().reverse(), [rows]);
  const [year, setYear] = useState(years[0] ?? "");
  const [who, setWho] = useState<"all" | "inhouse" | "outside">("all");
  const shown = rows.filter((r) => (year === "all" || r.quarter.startsWith(year)) && (who === "all" || (who === "inhouse" ? r.inHouse : !r.inHouse)));

  const download = () => {
    const head = ["quarter", "registrant", "client", "type", "amount_usd", "source_url", "retrieved_at"];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [head.join(","), ...shown.map((r) => [r.quarter, r.registrant, r.client, r.inHouse ? "in-house expenses" : "outside firm income", r.amount ?? "", r.sourceUrl, r.retrievedAt].map(esc).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `lobbying-filings-${year}-${who}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1">Year
          <select value={year} onChange={(e) => setYear(e.target.value)} className="rounded border border-line bg-surface px-2 py-1">
            <option value="all">All</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">Filer
          <select value={who} onChange={(e) => setWho(e.target.value as typeof who)} className="rounded border border-line bg-surface px-2 py-1">
            <option value="all">All</option>
            <option value="inhouse">In-house (company&apos;s own report)</option>
            <option value="outside">Outside firms</option>
          </select>
        </label>
        <span className="text-muted">{shown.length} filings</span>
        <button type="button" onClick={download} className="ml-auto rounded border border-line px-2 py-1 hover:bg-surface-2">Download CSV</button>
      </div>
      <div className="mt-2 max-h-[480px] overflow-auto rounded-md border border-line">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-surface-2 text-ink-2">
            <tr><th className="px-3 py-1.5">Quarter</th><th className="px-3 py-1.5">Registrant</th><th className="px-3 py-1.5">Client (as filed)</th><th className="px-3 py-1.5">Type</th><th className="px-3 py-1.5 text-right">Amount</th><th className="px-3 py-1.5">Source</th></tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-3 py-1.5 tabular">{r.quarter}</td>
                <td className="px-3 py-1.5">{r.registrant}</td>
                <td className="px-3 py-1.5 text-ink-2">{r.client}</td>
                <td className="px-3 py-1.5">{r.inHouse ? "In-house expenses" : "Outside firm income"}</td>
                <td className="px-3 py-1.5 text-right tabular">{usd(r.amount)}</td>
                <td className="px-3 py-1.5"><a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">LD-2 ↗</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-muted">&ldquo;—&rdquo; means the filing reported no amount (for example, a sub-contractor whose fees are included in the prime firm&apos;s report, or income under the $5,000 reporting threshold).</p>
    </div>
  );
}
