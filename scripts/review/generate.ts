// Generates the human-review files in data/review/. Re-running KEEPS any decisions you already
// entered in the "approved" column (matched by key), and adds rows for new data.
//
//  lda-client-aliases.csv  — which LDA client names count as the case company
//  lda-activities.csv      — whether each distinct lobbying-activity text is about the case
//
//  revolving-door.csv      — whether a lobbyist's prior government role overlaps with the client's industry
//
// How to review: open in Excel, fill the "approved" column, save as CSV, run `npm run data`.
//   aliases:     yes | no
//   activities:  glyphosate_direct | pesticide_policy | general
//   revolving:   approved_overlap = your note (or "none")
// Blank = not reviewed yet (the app shows the machine proposal with a "pending review" badge).
import { join } from "node:path";
import { readRaw } from "../lib/raw";
import { readCsvIfExists, writeCsv } from "../lib/csv";
import { classifyActivity } from "../../src/lib/relevance";
import { ldaQuarter } from "../../src/lib/quarters";
import { COMPANY_NAME, activityKey } from "../lib/review";

const DIR = join(process.cwd(), "data", "review");

function main() {
  const filings = readRaw<any[]>("lda/filings.json").data;

  // 1) Client aliases
  const prevA = new Map(readCsvIfExists(join(DIR, "lda-client-aliases.csv")).map((r) => [r.alias, r]));
  const counts = new Map<string, { n: number; first: string; last: string }>();
  for (const f of filings) {
    const q = ldaQuarter(f.filing_year, f.filing_period) ?? String(f.filing_year);
    const e = counts.get(f.client.name) ?? { n: 0, first: q, last: q };
    e.n++;
    if (q < e.first) e.first = q;
    if (q > e.last) e.last = q;
    counts.set(f.client.name, e);
  }
  const aliasRows = [...counts]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([alias, e]) => {
      const proposed = COMPANY_NAME.test(alias) ? "yes" : "no";
      return {
        alias,
        filings_in_window: e.n,
        first_quarter: e.first,
        last_quarter: e.last,
        proposed,
        reason: proposed === "yes" ? "Corporate Bayer/Monsanto name (or a firm filing on its behalf)" : "Not clearly the company (could be a different business or a private person)",
        approved: prevA.get(alias)?.approved ?? "",
      };
    });
  writeCsv(join(DIR, "lda-client-aliases.csv"), aliasRows, ["alias", "filings_in_window", "first_quarter", "last_quarter", "proposed", "reason", "approved"]);
  console.log(`  lda-client-aliases.csv: ${aliasRows.length} names (${aliasRows.filter((r) => r.proposed === "yes").length} proposed yes)`);

  // 2) Distinct activity texts that hit screening terms (strong or weak)
  const prevB = new Map(readCsvIfExists(join(DIR, "lda-activities.csv")).map((r) => [r.key, r]));
  const acts = new Map<string, any>();
  for (const f of filings) {
    if (!COMPANY_NAME.test(f.client.name)) continue;
    const q = ldaQuarter(f.filing_year, f.filing_period);
    if (!q) continue;
    for (const a of f.lobbying_activities ?? []) {
      const desc = (a.description ?? "").trim();
      if (!desc) continue;
      const cls = classifyActivity(desc);
      const weak = /label|uniformity|preempt|litigation|tort/i.test(desc);
      if (cls.relevance === "general" && !weak) continue;
      const key = activityKey(f.registrant.name, desc);
      const e = acts.get(key) ?? { key, registrant: f.registrant.name, issue_code: a.general_issue_code, quarters: new Set<string>(), proposed: cls.relevance, matched: cls.matched.join(" "), text: desc, example_url: f.filing_document_url };
      e.quarters.add(q);
      acts.set(key, e);
    }
  }
  const order: Record<string, number> = { glyphosate_direct: 0, pesticide_policy: 1, general: 2 };
  const actRows = [...acts.values()]
    .map((e) => ({ ...e, quarters_seen: [...e.quarters].sort().join(" "), n_quarters: e.quarters.size, approved: prevB.get(e.key)?.approved ?? "" }))
    .sort((a, b) => order[a.proposed] - order[b.proposed] || b.n_quarters - a.n_quarters);
  writeCsv(join(DIR, "lda-activities.csv"), actRows, ["key", "registrant", "issue_code", "proposed", "matched", "n_quarters", "quarters_seen", "text", "example_url", "approved"]);
  const by = (r: string) => actRows.filter((x) => x.proposed === r).length;
  console.log(`  lda-activities.csv: ${actRows.length} distinct texts (direct ${by("glyphosate_direct")}, pesticide ${by("pesticide_policy")}, general ${by("general")})`);

  // 3) Covered positions of lobbyists on case-related activity: industry-overlap tag
  const prevC = new Map(readCsvIfExists(join(DIR, "revolving-door.csv")).map((r) => [r.key, r]));
  const OVERLAP = /\b(agricultur\w*|usda|epa|environmental protection agency|pesticides?|farm\w*|food|rural|interior|natural resources|energy and commerce)\b/i;
  const cpRows = new Map<string, any>();
  for (const f of filings) {
    if (!COMPANY_NAME.test(f.client.name)) continue;
    for (const a of f.lobbying_activities ?? []) {
      if (classifyActivity(a.description).relevance === "general") continue;
      for (const l of a.lobbyists ?? []) {
        const cp = (l.covered_position ?? "").trim();
        if (!cp) continue;
        const name = `${l.lobbyist.first_name} ${l.lobbyist.last_name}`.replace(/\s+/g, " ").trim();
        const key = `${l.lobbyist.id}|${cp}`;
        if (cpRows.has(key)) continue;
        const m = cp.match(OVERLAP);
        cpRows.set(key, { key, lobbyist: name, covered_position: cp, proposed_overlap: m ? `Mentions "${m[0]}" — related to the client's agriculture/pesticide business` : "", example_url: f.filing_document_url, approved_overlap: prevC.get(key)?.approved_overlap ?? "" });
      }
    }
  }
  writeCsv(join(DIR, "revolving-door.csv"), [...cpRows.values()].sort((a, b) => a.lobbyist.localeCompare(b.lobbyist)), ["key", "lobbyist", "covered_position", "proposed_overlap", "example_url", "approved_overlap"]);
  console.log(`  revolving-door.csv: ${cpRows.size} covered positions (${[...cpRows.values()].filter((r) => r.proposed_overlap).length} with a proposed overlap note)`);
}

main();
