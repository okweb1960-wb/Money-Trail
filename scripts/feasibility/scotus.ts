// Phase 0 feasibility: Supreme Court docket for Monsanto Co. v. Durnell.
// Parses the Court's machine-readable docket JSON to extract every anchor date
// (petition, CVSG, U.S. briefs, grant, argument, opinion, judgment) with links.
// Also checks the DOJ Office of the Solicitor General's own page for the brief.
//
// Run: npx tsx scripts/feasibility/scotus.ts
//
// The docket number itself is the one input; it was found on supremecourt.gov and is
// verified below by checking the petitioner/respondent names in the returned docket.

import { fetchJson, checkUrl } from "../lib/http";
import { writeReport, type SourceReport } from "../lib/report";

const DOCKET = "24-1068";
const DOCKET_JSON = `https://www.supremecourt.gov/RSS/Cases/JSON/${DOCKET}.json`;
const DOCKET_HTML = `https://www.supremecourt.gov/search.aspx?filename=/docket/docketfiles/html/public/${DOCKET}.html`;
const OSG_PAGE = "https://www.justice.gov/osg/brief/monsanto-co-v-durnell";

type Entry = { Date: string; Text: string; Links?: Array<{ Description: string; File: string; DocumentUrl: string }> };

const toIso = (d: string) => {
  const t = new Date(`${d} 12:00 UTC`);
  return isNaN(+t) ? d : t.toISOString().slice(0, 10);
};
const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const mainDoc = (e: Entry) => e.Links?.find((l) => l.Description === "Main Document")?.DocumentUrl ?? null;

async function main() {
  const report: SourceReport = {
    source: "Supreme Court of the United States (docket JSON) + DOJ OSG",
    generated_at: new Date().toISOString(),
    window: { from: "n/a", to: "n/a" },
    base_urls: [DOCKET_JSON, OSG_PAGE],
    ok: false,
    checks: [],
    rate_limits: {},
    gaps: [],
    findings: {},
  };

  const r = await fetchJson<any>(DOCKET_JSON);
  const d = r.data;
  const caseOk = /monsanto/i.test(d.PetitionerTitle ?? "") && /durnell/i.test(d.RespondentTitle ?? "");
  report.checks.push({ name: "docket identity", ok: caseOk, detail: `${d.CaseNumber?.trim()}: ${d.PetitionerTitle} v. ${d.RespondentTitle}`, source_url: DOCKET_HTML });

  const entries: Entry[] = d.ProceedingsandOrder ?? [];
  const find = (re: RegExp) => entries.filter((e) => re.test(e.Text));

  const anchors: Array<{ key: string; label: string; date: string | null; text: string | null; document_url: string | null }> = [];
  const add = (key: string, label: string, e?: Entry, docUrl?: string | null) =>
    anchors.push({ key, label, date: e ? toIso(e.Date) : null, text: e ? strip(e.Text).slice(0, 400) : null, document_url: docUrl ?? (e ? mainDoc(e) : null) });

  add("petition_filed", "Petition for certiorari filed", find(/Petition for a writ of certiorari filed/i)[0]);
  add("cvsg", "Court invites the Solicitor General's views (CVSG)", find(/Solicitor General is invited/i)[0]);
  const usBriefs = find(/Brief amicus curiae of (the )?United States filed/i);
  add("us_brief_cert_stage", "U.S. (Solicitor General) amicus brief — certiorari stage", usBriefs[0]);
  add("cert_granted", "Certiorari granted", find(/Petition GRANTED/i)[0]);
  add("us_brief_merits", "U.S. (Solicitor General) amicus brief — merits stage", usBriefs[1]);
  add("sg_argument_motion", "SG motion to participate in oral argument granted", find(/Solicitor General.*GRANTED/i)[0]);
  add("argued", "Oral argument", find(/^Argued/i)[0]);
  const judgment = find(/^Judgment (REVERSED|AFFIRMED|VACATED)/i)[0];
  const opinionUrl = judgment?.Text.match(/href\s*=\s*'([^']+)'/)?.[1] ?? null;
  add("opinion", "Opinion of the Court / judgment", judgment, opinionUrl);
  add("mandate", "Judgment and mandate issued", find(/Judgment and Mandate Issued/i)[0]);

  for (const a of anchors) report.checks.push({ name: `anchor: ${a.key}`, ok: !!a.date, detail: a.date ? `${a.date}${a.document_url ? " — " + a.document_url : ""}` : "not found on docket" });

  // Verify document links resolve
  const linkChecks: any[] = [];
  for (const a of anchors.filter((x) => x.document_url)) {
    try {
      const c = await checkUrl(a.document_url!);
      linkChecks.push({ key: a.key, status: c.status, contentType: c.contentType });
    } catch (e) {
      linkChecks.push({ key: a.key, error: (e as Error).message });
    }
  }

  // DOJ OSG page (secondary copy of the U.S. brief, published by the filer)
  let osg: any = null;
  try {
    const res = await fetch(OSG_PAGE, { signal: AbortSignal.timeout(60_000) });
    const html = await res.text();
    const pdfs = [...html.matchAll(/href="([^"]+\.pdf)"/g)].map((m) => new URL(m[1], OSG_PAGE).href);
    osg = { status: res.status, title: html.match(/<title>([^<]+)<\/title>/)?.[1]?.trim() ?? null, pdf_links: [...new Set(pdfs)], retrieved_at: new Date().toISOString() };
    report.checks.push({ name: "DOJ OSG brief page", ok: res.ok && pdfs.length > 0, detail: `HTTP ${res.status}, ${pdfs.length} PDF link(s)`, source_url: OSG_PAGE });
  } catch (e) {
    report.checks.push({ name: "DOJ OSG brief page", ok: false, detail: (e as Error).message });
  }

  report.findings = {
    docket_number: d.CaseNumber?.trim(),
    caption: `${d.PetitionerTitle} v. ${d.RespondentTitle}`,
    docketed: d.DocketedDate,
    lower_court: d.LowerCourt,
    lower_court_case_numbers: d.LowerCourtCaseNumbers,
    lower_court_decision: d.LowerCourtDecision,
    question_presented_as_granted: strip(find(/Petition GRANTED/i)[0]?.Text ?? ""),
    docket_json_created: d.sJsonCreationDate,
    anchors,
    link_checks: linkChecks,
    osg_page: osg,
    amicus_brief_count: find(/Brief amic(us|i) curiae/i).length,
    docket_entries: entries.length,
    source_url: DOCKET_JSON,
    human_docket_url: DOCKET_HTML,
    retrieved_at: r.retrieved_at,
  };
  report.rate_limits = { note: "No API or documented rate limit; the docket JSON is a static file regenerated by the Court. One request per run." };
  report.gaps.push(
    "There is no official Supreme Court API. The docket JSON (RSS/Cases/JSON) is undocumented and could change format without notice; the HTML docket page is the fallback.",
    "The docket gives dates only, not times. U.S. briefs are identified by docket text ('Brief amicus curiae of United States filed'); the cert-stage vs merits-stage label is inferred from their order relative to the grant.",
    "The DOJ OSG page links only the merits-stage brief; the cert-stage (CVSG) brief is linked from the Supreme Court docket.",
    "Lower-court records (Missouri Court of Appeals, trial court) are not on this docket's links beyond the electronic record notice.",
  );
  report.ok = report.checks.every((c) => c.ok);
  writeReport("scotus", report);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
