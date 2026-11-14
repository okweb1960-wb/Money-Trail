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

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

function Row({ r }: { r: AmicusRow }) {
  const lobbying = (r.ldaInHouse ?? 0) + (r.ldaOutside ?? 0);
  return (
    <li className="border-t border-line py-1.5 first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">{r.filer}</span>
        <span className="tabular text-xs text-muted">{r.filedOn}</span>
        {r.sidePhrase && <span className="text-xs text-ink-2">cover: &ldquo;{r.sidePhrase}&rdquo;</span>}
        <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs">brief ↗</a>
      </div>
      {[...new Set([...r.partyMentions, ...r.counselOverlap])].map((sentence) => (
        <p key={sentence} className="mt-1 rounded-sm bg-surface-2 px-2 py-1 text-xs">
          <span className="font-semibold">{r.counselOverlap.includes(sentence) ? "Disclosure about its lawyers: " : "Disclosure naming a party: "}</span>&ldquo;{sentence}&rdquo;
        </p>
      ))}
      <details className="mt-0.5 text-xs">
        <summary className="cursor-pointer text-ink-2">Who wrote and funded it (as the brief states)</summary>
        {r.disclosure ? (
          <div className="mt-1 space-y-1 pl-3">
            <p>&ldquo;{r.disclosure}&rdquo;</p>
            <ul className="list-disc pl-4 text-ink-2">
              <li>A party&apos;s lawyers wrote any of it: {r.partyCounselDenied === true ? "no, according to the statement" : "the statement does not use the usual wording — read it above"}</li>
              <li>Money from others: {r.membersExcepted ? "none except from the group itself, its members, or its lawyers (members are not named)" : "none except from the filer itself or its lawyers"}</li>
            </ul>
          </div>
        ) : (
          <p className="mt-1 pl-3 text-ink-2">No authorship or funding statement found in the brief text{r.filerKind === "united_states" || r.filerKind === "government" ? " (government filer)" : ""}.</p>
        )}
        {r.filerKind === "organization" && (
          <p className="mt-1 pl-3 text-ink-2">
            {lobbying > 0 && r.ldaExample ? (
              <>Reported its own federal lobbying in {r.ldaYears}: {usd(lobbying)} (<a href={r.ldaExample} target="_blank" rel="noopener noreferrer">LD-2 example ↗</a>). This is what the group spent on lobbying, not who funds the group.</>
            ) : (
              <>No federal lobbying reports found under this name for {r.ldaYears ?? "the last two years"}.</>
            )}
          </p>
        )}
        {r.filerKind === "organization" && <IrsLine r={r} />}
      </details>
    </li>
  );
}

// IRS tax-exempt types, by Internal Revenue Code section 501(c) paragraph.
export const SUBSECTION: Record<number, string> = {
  3: "501(c)(3) charity",
  4: "501(c)(4) social welfare group",
  5: "501(c)(5) labor or agricultural organization",
  6: "501(c)(6) business league / trade association",
};

function IrsLine({ r }: { r: AmicusRow }) {
  if (r.irsStatus === "matched" && r.irsRevenue != null) {
    return (
      <p className="mt-1 pl-3 text-ink-2">
        IRS Form 990, tax year {r.irsTaxYear} ({r.irsName}{r.irsSubsection ? `, ${SUBSECTION[r.irsSubsection] ?? `501(c)(${r.irsSubsection})`}` : ""}): total revenue {usd(r.irsRevenue)}, of which contributions and grants {usd(r.irsContributions ?? 0)} and program-service revenue (which can include member dues) {usd(r.irsProgramRevenue ?? 0)}.{" "}
        {r.irsPdf && <a href={r.irsPdf} target="_blank" rel="noopener noreferrer">990 PDF ↗</a>}{" "}
        {r.irsOrgPage && <a href={r.irsOrgPage} target="_blank" rel="noopener noreferrer">all filings ↗</a>}{" "}
        Donor names are not public on Form 990.
      </p>
    );
  }
  return (
    <p className="mt-1 pl-3 text-ink-2">
      IRS Form 990: {r.irsStatus === "ambiguous" ? "several IRS entities share this exact name, so none is shown." : "no IRS filer found under this exact name (it may file under a different legal name, or be a coalition)."}
    </p>
  );
}

/** Finances (latest Form 990) of organizations that filed, side by side. */
export function IrsSummary({ rows, petitioner, respondent }: { rows: AmicusRow[]; petitioner: string; respondent: string }) {
  const seen = new Set<string>();
  const orgs = rows.filter((r) => r.filerKind === "organization" && r.irsStatus === "matched" && r.irsEin && (r.side === "petitioner" || r.side === "respondent") && !seen.has(r.irsEin + r.side) && seen.add(r.irsEin + r.side));
  const table = (side: string, title: string) => {
    const rs = orgs.filter((r) => r.side === side).sort((a, b) => (b.irsRevenue ?? 0) - (a.irsRevenue ?? 0));
    return (
      <div className="overflow-x-auto rounded-lg border border-line bg-surface p-3">
        <h4 className="font-semibold">{title}</h4>
        <table className="mt-2 w-full text-left text-xs tabular">
          <thead className="text-ink-2"><tr><th className="py-1 pr-2">Organization</th><th className="pr-2">Type</th><th className="pr-2 text-right">Revenue</th><th className="pr-2 text-right">Contributions &amp; grants</th><th className="pr-2 text-right">Program revenue</th><th>990</th></tr></thead>
          <tbody>
            {rs.map((r) => (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="py-1 pr-2">{r.filer}</td>
                <td className="whitespace-nowrap pr-2 text-ink-2">{r.irsSubsection ? `501(c)(${r.irsSubsection})` : ""}</td>
                <td className="pr-2 text-right">{usd(r.irsRevenue ?? 0)}</td>
                <td className="pr-2 text-right">{usd(r.irsContributions ?? 0)}</td>
                <td className="pr-2 text-right">{usd(r.irsProgramRevenue ?? 0)}</td>
                <td className="whitespace-nowrap">{(r.irsPdf ?? r.irsOrgPage) && <a href={(r.irsPdf ?? r.irsOrgPage)!} target="_blank" rel="noopener noreferrer">{r.irsTaxYear} ↗</a>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  if (!orgs.length) return null;
  return (
    <div className="mt-6">
      <p className="text-sm font-semibold">Finances of the organizations that filed (IRS Form 990, most recent year available)</p>
      <p className="mt-1 max-w-3xl text-xs text-muted">
        Form 990 shows how much an organization takes in and what kind of income it is. It does not show donor names, which are withheld from public copies for most organizations, and it does not show what any money was used for in this case.
        &ldquo;Program revenue&rdquo; often includes membership dues for trade associations.
      </p>
      <div className="mt-2 grid gap-3 lg:grid-cols-2">
        {table("petitioner", `Supporting ${petitioner} (petitioner)`)}
        {table("respondent", `Supporting ${respondent} (respondent)`)}
      </div>
    </div>
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
      <IrsSummary rows={rows} petitioner={petitioner} respondent={respondent} />
    </div>
  );
}
