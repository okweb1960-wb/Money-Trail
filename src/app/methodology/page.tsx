import type { Metadata } from "next";
import Link from "next/link";
import { RULES, RULE_TEXT, FLAG_FOOTNOTE } from "@/lib/flags";
import { ClaimBadge, PendingBadge, RecordBadge } from "@/components/Badges";

export const metadata: Metadata = { title: "Methodology" };

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return <h2 id={id} className="mt-10 scroll-mt-6 text-xl font-semibold">{children}</h2>;
}

export default function Methodology() {
  return (
    <article className="max-w-3xl text-[15px] leading-relaxed">
      <h1 className="text-3xl font-semibold">Methodology</h1>
      <p className="mt-2 text-ink-2">How the data is collected, how patterns are flagged, and what this site will and will not say.</p>

      <H id="principles">What this site does</H>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Shows when lobbying, political contributions and government decisions happened, and how they connect in public records.</li>
        <li>Uses wording like &ldquo;followed&rdquo;, &ldquo;preceded&rdquo; and &ldquo;in the same quarter&rdquo;. It never says that money caused, bought or influenced a decision.</li>
        <li>Links every fact to the primary source it came from, with the date it was retrieved.</li>
      </ul>

      <H id="labels">RECORD and CLAIM</H>
      <p className="mt-2"><RecordBadge /> means the item was taken from a primary public source (a lobbying report, an FEC filing, the Federal Register, a court docket). <ClaimBadge /> means a named person said it in public; this site does not treat it as fact and shows what the record does and does not show next to it.</p>
      <p className="mt-2"><PendingBadge /> means a screening rule made the classification and a person has not checked it yet.</p>

      <H id="nonpartisan">Nonpartisan statement</H>
      <p className="mt-2">The same data rules, flag rules, thresholds, wording and colors apply to every company, party and administration. The flag rules never read a party, an administration or a name; an automated test renames every actor and checks that the results do not change. Colors identify the <em>type</em> of thing (company, firm, PAC, official, decision), never a party. People appear only if they are public officials or registered lobbyists tied to a specific decision.</p>

      <H id="data">Data sources and how they are used</H>
      <ul className="mt-2 list-disc space-y-2 pl-5">
        <li><strong>Senate Lobbying Disclosure Act reports</strong> (lda.gov API). Quarterly LD-2 reports for the company and for outside firms filing on its behalf, from 2018. Only the latest version of each quarterly report is used (amendments replace originals). The company&apos;s own report states <em>expenses</em>; outside firms state <em>income</em> from the client. The two are shown separately and never added together, because the company&apos;s total may already include what it pays outside firms.</li>
        <li><strong>LD-2 activity text</strong>. Each report lists issues in free text. A screening rule labels a line as naming glyphosate, as pesticide policy (FIFRA, pesticide labeling), or as general; a person then confirms each distinct text in <code>data/review/lda-activities.csv</code>.</li>
        <li><strong>FEC</strong> (OpenFEC API). Itemized disbursements of the company-affiliated PACs, with the FEC&apos;s own committee name history. Only federal recipients are counted. Payments to state and local candidates, and transfers between the company&apos;s own PACs, are excluded. Memo entries are skipped to avoid double counting.</li>
        <li><strong>Supreme Court docket</strong> for <em>Monsanto Co. v. Durnell</em> (No. 24-1068): dates, filings and the text of the U.S. briefs&apos; conclusions and the opinion&apos;s syllabus.</li>
        <li><strong>Federal Register</strong>: the executive order is found by searching presidential documents for &ldquo;glyphosate&rdquo;, not entered by hand.</li>
        <li><strong>Amicus organizations</strong>: groups that filed amicus briefs are read from the docket. Filers named as individual people, the United States (shown as the Solicitor General) and officials (shown separately) are excluded. The side each brief supports is read from the words on the brief&apos;s own cover (&ldquo;in support of petitioner&rdquo;, &ldquo;supporting respondent&rdquo;, or a party&apos;s name); the exact phrase is shown. If a cover states no side, the site says so and does not guess. The same rule is applied to every filer, including officials, states and the United States.</li>
        <li><strong>Claims</strong>: statements are quoted from a published transcript and linked to the timestamp in the episode. Only statements about this case&apos;s decisions are included; allegations about private individuals and allegations of crimes that the loaded records cannot address are left out.</li>
        <li><strong>U.S. Code</strong> (uscode.house.gov): cited for the lobbying-disclosure and post-employment rules on the revolving-door page.</li>
      </ul>

      <H id="review">Human review</H>
      <p className="mt-2">Three files in <code>data/review/</code> hold the decisions a person must make: which company-name variants count as the company, whether each lobbying text is about the case, and whether a lobbyist&apos;s prior role overlaps with the client&apos;s industry. Until a row is reviewed, the site shows the machine proposal with a pending label.</p>
      <p className="mt-2">First review: on 2026-11-13 the project owner delegated the first pass to Claude, an AI assistant. Every decision and its reason are recorded in the <code>reviewed_by</code> and <code>review_note</code> columns, so anyone can check or change them. Changes made in that pass: nine trade entries about other countries&apos; chemical rules were marked general; three entries for H.R. 4288 (described elsewhere in the same filings as the Agricultural Labeling Uniformity Act) were marked pesticide policy; industry-overlap notes were written only from the role text as filed.</p>

      <H id="rules">Pattern-flag rules</H>
      <p className="mt-2">Thresholds (global constants, the same for every case): window {RULES.WINDOW_BEFORE_Q} quarters before / {RULES.WINDOW_AFTER_Q} after a decision; spend flag at ≥{RULES.SPEND_ABOVE_PCT}% above the median of the {RULES.BASELINE_Q} preceding quarters (at least {RULES.BASELINE_MIN_Q} needed); contributions within {RULES.CONTRIB_LOOKBACK_MONTHS} months before a decision. Only the four items marked as decisions are used; other docket events are context.</p>
      <dl className="mt-3 space-y-3">
        {Object.entries(RULE_TEXT).map(([k, v]) => (
          <div key={k} className="rounded-md border border-line bg-surface p-3">
            <dt className="font-semibold">{v.title}</dt>
            <dd className="mt-1 text-ink-2">{v.how}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-ink-2">{FLAG_FOOTNOTE}</p>

      <H id="limits">Known limits</H>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Lobbying amounts are company-wide quarterly totals, not amounts per issue. The company also lobbies on unrelated topics.</li>
        <li>Lobbying reports name the government bodies contacted but not who was met, when, or what was said.</li>
        <li>Court decisions are not lobbied under the Lobbying Disclosure Act; the briefs and the ruling are shown for timing only.</li>
        <li>Executive-branch officials are not FEC candidates, so contributions can only be linked to officials who run for office.</li>
        <li>The executive order&apos;s full text could not be retrieved in the build environment; only its title and Federal Register metadata are used.</li>
        <li>Dates are day-precision; lobbying data is quarter-precision.</li>
      </ul>

      <H id="colors">Charts and colors</H>
      <p className="mt-2">Charts use one y-axis each; measures with different units are shown as separate charts on a shared time axis. Series colors come from a palette checked for color-vision deficiency; every chart has a table view, and node types in the network also differ by shape.</p>

      <p className="mt-10"><Link href="/sources">Data sources and retrieval dates →</Link></p>
    </article>
  );
}
