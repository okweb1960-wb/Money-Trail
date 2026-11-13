import type { AmicusRow } from "@/lib/data";
import { RecordBadge } from "./Badges";

// Who filed amicus briefs and which side each brief's cover says it supports.
// Both sides get identical, neutral styling.

const KIND_LABEL: Record<string, string> = {
  united_states: "United States (Solicitor General)",
  government: "States",
  official: "Elected officials",
  organization: "Organizations",
  individuals: "Individuals",
};
const KIND_ORDER = ["united_states", "government", "official", "organization", "individuals"];

function Row({ r }: { r: AmicusRow }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 border-t border-line py-1.5 first:border-t-0">
      <span className="font-medium">{r.filer}</span>
      <span className="tabular text-xs text-muted">{r.filedOn}</span>
      {r.sidePhrase && <span className="text-xs text-ink-2">cover: &ldquo;{r.sidePhrase}&rdquo;</span>}
      <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs">brief ↗</a>
    </li>
  );
}

function Column({ title, rows }: { title: string; rows: AmicusRow[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <h4 className="font-semibold">{title}</h4>
      <p className="text-xs text-muted">{rows.length} brief{rows.length === 1 ? "" : "s"}</p>
      {KIND_ORDER.map((k) => {
        const rs = rows.filter((r) => r.filerKind === k);
        if (!rs.length) return null;
        return (
          <div key={k} className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{KIND_LABEL[k]} ({rs.length})</p>
            <ul className="mt-1 text-sm">{rs.map((r) => <Row key={r.id} r={r} />)}</ul>
          </div>
        );
      })}
    </div>
  );
}

export function AmicusSides({ rows, petitioner, respondent }: { rows: AmicusRow[]; petitioner: string; respondent: string }) {
  const merits = rows.filter((r) => r.stage === "merits");
  const petition = rows.filter((r) => r.stage === "petition");
  const by = (rs: AmicusRow[], s: string) => rs.filter((r) => r.side === s);
  const other = merits.filter((r) => r.side !== "petitioner" && r.side !== "respondent");
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold">Who filed briefs in the Supreme Court, and on which side</h3>
        <RecordBadge />
      </div>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Each side is taken from the words on the brief&apos;s own cover (for example &ldquo;in support of petitioner&rdquo;). The petitioner is {petitioner}; the respondent is {respondent}.
        A brief&apos;s side shows only which party it asked the Court to rule for; it does not show who funded or wrote it.
      </p>

      <p className="mt-4 text-sm font-semibold">Merits stage — arguing how the Court should rule ({merits.length} briefs)</p>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <Column title={`Supporting ${petitioner} (petitioner)`} rows={by(merits, "petitioner")} />
        <Column title={`Supporting ${respondent} (respondent)`} rows={by(merits, "respondent")} />
      </div>
      {other.length > 0 && (
        <div className="mt-3"><Column title="Supporting neither party, or no side stated on the cover" rows={other} /></div>
      )}

      {petition.length > 0 && (
        <>
          <p className="mt-5 text-sm font-semibold">Petition stage — on whether the Court should take the case ({petition.length} briefs)</p>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <Column title={`Supporting ${petitioner} (petitioner)`} rows={by(petition, "petitioner")} />
            <Column title={`Supporting ${respondent} (respondent)`} rows={by(petition, "respondent")} />
          </div>
          {by(petition, "not_stated").length > 0 && (
            <p className="mt-2 text-sm text-ink-2">
              No side stated on the cover: {by(petition, "not_stated").map((r) => r.filer).join(", ")}. The U.S. brief at this stage concludes that the petition &ldquo;should be granted&rdquo; (see the decisions above).
            </p>
          )}
        </>
      )}
      <p className="mt-3 text-xs text-muted">Briefs filed by individual people are counted but not named, because this site names only public officials and registered lobbyists. Their briefs are on the Supreme Court docket.</p>
    </div>
  );
}
