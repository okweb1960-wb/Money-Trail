import type { Metadata } from "next";
import { getRevolvingDoor } from "@/lib/data";
import { PendingBadge, RecordBadge } from "@/components/Badges";

export const metadata: Metadata = { title: "Revolving door · Glyphosate" };

export default async function RevolvingDoorPage() {
  const rows = await getRevolvingDoor();
  const withRoles = rows.filter((r) => r.positions.length);
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Glyphosate</p>
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold">Revolving door</h1><RecordBadge /></div>
      <p className="mt-2 max-w-3xl text-[15px] text-ink-2">
        Lobbyists listed on case-related lobbying activity (glyphosate or pesticide policy) within two quarters of a decision, and the prior government positions they reported. Positions are quoted exactly as filed on LD-2 reports.
      </p>
      <div className="mt-4 max-w-3xl rounded-md border border-line bg-surface p-3 text-sm text-ink-2">
        <p className="font-semibold text-ink">Is this legal?</p>
        <p className="mt-1">
          Generally, yes. The Lobbying Disclosure Act requires a lobbyist&apos;s registration to list any &ldquo;covered&rdquo; executive or legislative branch position held in the 20 years before they began lobbying for the client (
          <a href="https://uscode.house.gov/us/usc/t2/s1603/" target="_blank" rel="noopener noreferrer">2 U.S.C. § 1603(b)(6) ↗</a>). Disclosure is the requirement; having held such a position does not by itself bar someone from lobbying.
        </p>
        <p className="mt-2">
          Separately, federal ethics law restricts certain contacts by former officials: permanently for particular matters they worked on, and for one or two years for some roles, including senior executive branch personnel and Members of Congress and legislative staff (
          <a href="https://uscode.house.gov/us/usc/t18/s207/" target="_blank" rel="noopener noreferrer">18 U.S.C. § 207, subsections (a), (c), (d), (e) ↗</a>).
          This page does not assess whether anyone followed those rules, and listing a prior role does not suggest wrongdoing.
        </p>
      </div>
      <p className="mt-6 text-sm text-muted">{rows.length} lobbyists on case-related activity near a decision; {withRoles.length} reported at least one prior government position.</p>
      <div className="mt-2 overflow-x-auto rounded-md border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs text-ink-2">
            <tr><th className="px-3 py-2">Lobbyist</th><th className="px-3 py-2">Registrant(s)</th><th className="px-3 py-2">Prior government position (as filed)</th><th className="px-3 py-2">Overlap with the client&apos;s industry</th><th className="px-3 py-2">Seen</th><th className="px-3 py-2">Source</th></tr>
          </thead>
          <tbody>
            {rows.flatMap((r) =>
              (r.positions.length ? r.positions : [null]).map((p, i) => (
                <tr key={r.lobbyistId + i} className="border-t border-line align-top">
                  <td className="px-3 py-2 font-medium">{i === 0 ? r.name : ""}{i === 0 && r.pending && <><br /><PendingBadge /></>}</td>
                  <td className="px-3 py-2 text-ink-2">{i === 0 ? r.registrants : ""}</td>
                  <td className="px-3 py-2">{p ? <>&ldquo;{p.text}&rdquo;</> : <span className="text-muted">None reported</span>}</td>
                  <td className="px-3 py-2 text-ink-2">{p?.overlap ?? (p ? <span className="text-muted">—</span> : "")}{p?.overlap && p.overlapPending && <><br /><PendingBadge /></>}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular text-ink-2">{p ? `${p.firstQuarter}–${p.lastQuarter}` : ""}</td>
                  <td className="px-3 py-2">{p && <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">LD-2 ↗</a>}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">The overlap column is a reviewer&apos;s note. Until a person reviews it, it shows the screening rule&apos;s proposal (prior roles that mention agriculture, the EPA, pesticides or related committees) marked &ldquo;pending review&rdquo;.</p>
    </div>
  );
}
