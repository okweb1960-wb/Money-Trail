import type { Metadata } from "next";
import Link from "next/link";
import { getAmicusBriefs, getCaseActivities, getDecisions, getFlags, getLobbyingFilings, getReviewStatus, getTimeline, RULES } from "@/lib/data";
import { AmicusSides } from "@/components/AmicusSides";
import { Timeline } from "@/components/Timeline";
import { ViewOnly, ViewProvider, ViewToggle } from "@/components/ViewToggle";
import { FlagCard } from "@/components/FlagCard";
import { FilingsTable } from "@/components/FilingsTable";
import { PendingBadge, RecordBadge, SourceLink } from "@/components/Badges";

export const metadata: Metadata = { title: "Glyphosate case" };

const fmtDate = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

export default async function GlyphosateCase() {
  const [decisions, timeline, flags, filings, activities, review, amicus] = await Promise.all([getDecisions(), getTimeline(), getFlags(), getLobbyingFilings(), getCaseActivities(), getReviewStatus(), getAmicusBriefs()]);
  const majors = decisions.filter((d) => d.tier === "decision");
  const grant = decisions.find((d) => d.id.endsWith(":cert_granted"));
  const opinion = decisions.find((d) => d.id.endsWith(":opinion"));
  const eo = decisions.find((d) => d.kind === "executive_order");
  const briefs = decisions.filter((d) => d.kind === "court_brief");
  const issueFlag = flags.find((f) => f.rule === "issue_named_near_decision");
  const firmFlag = flags.find((f) => f.rule === "new_outside_firm");
  const spendFlags = flags.filter((f) => f.rule === "spend_above_own_baseline");
  const directEntries = activities.filter((a) => a.relevance === "glyphosate_direct");
  const fkaFiling = filings.find((f) => /FKA MONSANTO|FORMERLY KNOWN AS MONSANTO/i.test(f.client));
  const contribFlag = flags.find((f) => f.rule === "contribution_to_decision_participant");

  return (
    <ViewProvider>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Case</p>
          <h1 className="text-3xl font-semibold">Glyphosate</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
            How lobbying and political contributions connected to the company that files lobbying reports as{" "}
            {fkaFiling ? <a href={fkaFiling.sourceUrl} target="_blank" rel="noopener noreferrer">&ldquo;{fkaFiling.client}&rdquo;</a> : "Bayer / Monsanto"}{" "}
            line up in time with four federal decisions about glyphosate: two U.S. government briefs in <em>Monsanto Co. v. Durnell</em>, an executive order, and the Supreme Court&apos;s ruling.
            {opinion && <> The Court&apos;s opinion describes Monsanto as the maker of Roundup, a glyphosate-based herbicide (<a href={opinion.sourceUrl} target="_blank" rel="noopener noreferrer">opinion, p. 1 ↗</a>).</>}
          </p>
        </div>
        <ViewToggle />
      </div>

      {(review.pendingActivities > 0 || review.pendingAliases > 0) && (
        <p className="mt-4 rounded-md border border-line bg-surface p-3 text-sm text-ink-2">
          <PendingBadge /> Some classifications were made by a screening rule and have not been reviewed by a person yet ({review.pendingActivities} lobbying entries, {review.pendingAliases} company-name variants). They are labelled where they appear. <Link href="/methodology#review">How review works</Link>
        </p>
      )}

      <section className="mt-8 rounded-lg border border-line bg-surface p-4" aria-labelledby="tl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="tl" className="text-lg font-semibold">Timeline</h2>
          <RecordBadge />
        </div>
        <p className="mb-4 text-sm text-muted">Quarterly data, {timeline.firstQuarter} to {timeline.lastQuarter}. Lines mark the dates of the four decisions.</p>
        <Timeline rows={timeline.rows} decisions={majors.map((d) => ({ id: d.id, title: d.title, date: d.date, quarter: d.quarter, sourceUrl: d.sourceUrl }))} />
      </section>

      <ViewOnly view="citizen">
        <section className="mt-10" aria-labelledby="what">
          <h2 id="what" className="text-xl font-semibold">What happened, in order</h2>
          <p className="mt-1 text-sm text-muted">Every item is from a court docket or the Federal Register. Quotes are the documents&apos; own words.</p>
          <ol className="mt-4 space-y-3 border-l border-line pl-4">
            {decisions.map((d) => (
              <li key={d.id} className="relative">
                <span aria-hidden className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full" style={{ background: d.tier === "decision" ? "var(--ink)" : "var(--axis)" }} />
                <p className="text-sm tabular text-ink-2">{fmtDate(d.date)} · {d.tier === "decision" ? "Decision" : "Case event"}</p>
                <p className="font-medium">{d.title} <span className="font-normal text-ink-2">— {d.decidedBy}</span></p>
                {d.summary && <p className="mt-0.5 text-[15px] text-ink-2">{d.summary}</p>}
                <SourceLink href={d.sourceUrl} retrievedAt={d.retrievedAt}>Read the source</SourceLink>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10 max-w-3xl" aria-labelledby="effects">
          <h2 id="effects" className="text-xl font-semibold">What the decisions say they change</h2>
          <p className="mt-1 text-sm text-muted">Only what the documents themselves state. No predictions.</p>
          <div className="mt-3 space-y-4 text-[15px] leading-relaxed">
            {grant && <p><strong>The question the Supreme Court took up</strong> ({fmtDate(grant.date)}): {grant.summary?.replace(/^Docket: /, "")} <SourceLink href={grant.quoteSource ?? grant.sourceUrl}>docket</SourceLink></p>}
            {opinion && (
              <p>
                <strong>The ruling</strong> ({fmtDate(opinion.date)}). The Court&apos;s summary (the syllabus) says: {opinion.summary}{" "}
                <SourceLink href={opinion.sourceUrl}>opinion PDF</SourceLink>
                <br />
                <span className="text-ink-2">In everyday terms, the document says this kind of lawsuit — a state-law claim that a product label should have carried a cancer warning that the EPA did not require — cannot go forward under state law. Read the opinion for its exact limits.</span>
              </p>
            )}
            {eo && (
              <p>
                <strong>The executive order</strong> ({fmtDate(eo.date)}): {eo.summary} <SourceLink href={eo.sourceUrl}>Federal Register</SourceLink>
                <br />
                <span className="text-ink-2">This app has not yet summarized the order&apos;s provisions, because its full text could not be retrieved from this build environment. Read it at the link.</span>
              </p>
            )}
            {briefs.map((b) => (
              <p key={b.id}><strong>{b.title}</strong> ({fmtDate(b.date)}): the brief concludes {b.summary} <SourceLink href={b.sourceUrl}>brief PDF</SourceLink></p>
            ))}
          </div>
        </section>

        <section className="mt-10 max-w-3xl" aria-labelledby="pattern-plain">
          <h2 id="pattern-plain" className="text-xl font-semibold">The pattern, in plain English</h2>
          <div className="mt-2 space-y-3 text-[15px] leading-relaxed">
            <p>Companies report their lobbying to Congress every quarter. In the quarters around these decisions, the company&apos;s outside lobbying firms reported more income from it than in the two years before{spendFlags.length ? ` (up to ${Math.max(...spendFlags.map((f) => Number(f.baseline.percentAbove) || 0))}% above its own usual level)` : ""}, and new firms started working for it.</p>
            <p>That is a timing pattern. It does not show why the spending changed, what was discussed, or that it affected any decision. Courts, agencies and the White House are lobbied by many groups on all sides of an issue, and the company also lobbies on many unrelated topics.</p>
            {contribFlag ? (
              <p>{contribFlag.wording}</p>
            ) : (
              <p>The records loaded here (FEC filings of the company&apos;s PACs and the company&apos;s LD-203 reports) show no contributions to the federal officials who filed briefs in this case during the {RULES.CONTRIB_LOOKBACK_MONTHS} months before the ruling.</p>
            )}
          </div>
        </section>
      </ViewOnly>

      <section className="mt-10" aria-label="Amicus briefs by side">
        <AmicusSides rows={amicus.rows} petitioner={amicus.petitioner} respondent={amicus.respondent} />
      </section>

      <section className="mt-10" aria-labelledby="flags">
        <h2 id="flags" className="text-xl font-semibold">Pattern flags</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Rule-based checks, applied the same way to every company and administration. Each shows what was observed, the company&apos;s own baseline, and the filings behind it.
          A flag means &ldquo;worth a closer look&rdquo;, never a verdict. <Link href="/methodology#rules">How the rules work</Link>
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {flags.map((f) => <FlagCard key={f.id} flag={f} />)}
        </div>
        {flags.length === 0 && <p className="mt-4 text-sm">No rule fired for this case.</p>}
      </section>

      <ViewOnly view="investigator">
        <section className="mt-10" aria-labelledby="lead">
          <h2 id="lead" className="text-xl font-semibold">The lead</h2>
          <ul className="mt-2 max-w-3xl list-disc space-y-1 pl-5 text-[15px]">
            {spendFlags.length > 0 && <li>Outside-firm lobbying income was above the company&apos;s own 8-quarter median in {spendFlags.map((f) => f.window).join(", ")} — the quarters around the U.S. briefs, the executive order and the ruling.</li>}
            {firmFlag && <li>New outside firms appear in the same period: {(firmFlag.observed.newFirms as Array<{ name: string; firstQuarter: string }>).map((f) => `${f.name} (${f.firstQuarter})`).join(", ")}.</li>}
            {issueFlag && <li>{issueFlag.wording}</li>}
            <li>{directEntries.length} lobbying entries name glyphosate directly; see the table below.</li>
          </ul>
        </section>

        <section className="mt-8" aria-labelledby="dig">
          <h2 id="dig" className="text-xl font-semibold">Where to dig</h2>
          <ol className="mt-2 max-w-3xl list-decimal space-y-2 pl-5 text-[15px]">
            {issueFlag && <li>Read the new lobbying texts filed around the executive order and note which offices they list: {issueFlag.evidence.slice(0, 3).map((e, i) => <a key={e.url + i} href={e.url} target="_blank" rel="noopener noreferrer" className="mr-2">filing {i + 1} ↗</a>)}</li>}
            {firmFlag && <li>Open the first report of each new firm and read its &ldquo;specific lobbying issues&rdquo;: {firmFlag.evidence.map((e, i) => <a key={e.url + i} href={e.url} target="_blank" rel="noopener noreferrer" className="mr-2">{e.label.split(" — ")[0]} ↗</a>)}</li>}
            <li>Compare the government bodies listed on case-related entries with the body behind each decision (DOJ for the briefs; White House offices for the order). The case-related entries table below lists them.</li>
            <li>Read both U.S. briefs in full: {briefs.map((b) => <a key={b.id} href={b.sourceUrl} target="_blank" rel="noopener noreferrer" className="mr-2">{b.title} ↗</a>)}</li>
            {grant && <li>Review every brief filed by public officials and other groups on the <a href={grant.quoteSource ?? grant.sourceUrl} target="_blank" rel="noopener noreferrer">Supreme Court docket ↗</a>.</li>}
            <li>Check the revolving-door page for lobbyists whose prior roles overlap with the bodies involved: <Link href="/cases/glyphosate/revolving-door">revolving door</Link>.</li>
            <li>Help review the screening: open <code>data/review/lda-activities.csv</code> in the repository and confirm or correct each proposed label.</li>
          </ol>
        </section>

        <section className="mt-8" aria-labelledby="entries">
          <h2 id="entries" className="text-xl font-semibold">Case-related lobbying entries</h2>
          <p className="mt-1 text-sm text-muted">{activities.length} entries mention glyphosate or pesticide policy. Verbatim text from LD-2 reports.</p>
          <div className="mt-2 max-h-[480px] overflow-auto rounded-md border border-line">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface-2 text-ink-2"><tr><th className="px-3 py-1.5">Quarter</th><th className="px-3 py-1.5">Registrant</th><th className="px-3 py-1.5">Label</th><th className="px-3 py-1.5">Text (as filed)</th><th className="px-3 py-1.5">Bodies contacted</th><th className="px-3 py-1.5">Source</th></tr></thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.id} className="border-t border-line align-top">
                    <td className="px-3 py-1.5 tabular">{a.quarter}</td>
                    <td className="px-3 py-1.5">{a.registrant}</td>
                    <td className="px-3 py-1.5">{a.relevance === "glyphosate_direct" ? "names glyphosate" : "pesticide policy"}{a.pending && <><br /><PendingBadge /></>}</td>
                    <td className="max-w-[420px] px-3 py-1.5 text-ink-2">{a.description.length > 400 ? a.description.slice(0, 400) + "…" : a.description}</td>
                    <td className="px-3 py-1.5 text-ink-2">{a.govEntities.join("; ")}</td>
                    <td className="px-3 py-1.5"><a href={a.sourceUrl} target="_blank" rel="noopener noreferrer">LD-2 ↗</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8" aria-labelledby="filings">
          <h2 id="filings" className="text-xl font-semibold">All lobbying filings</h2>
          <p className="mb-2 mt-1 text-sm text-muted">Latest version of each quarterly report (amendments replace originals).</p>
          <FilingsTable rows={filings} />
        </section>
      </ViewOnly>
    </ViewProvider>
  );
}
