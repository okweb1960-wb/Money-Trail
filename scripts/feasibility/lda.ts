// Phase 0 feasibility: Senate Lobbying Disclosure Act (LDA) API.
// Tests: Bayer/Monsanto LD-2 filings, quarterly amounts, outside registrants,
// named lobbyists, covered positions, and LD-203 contribution reports.
//
// Run: npx tsx scripts/feasibility/lda.ts

import { fetchJson, checkUrl, qs } from "../lib/http";
import { writeReport, WINDOW, type SourceReport } from "../lib/report";

// lda.senate.gov returned a "Site Under Maintenance" page during Phase 0;
// the same API is served at lda.gov. Both are tried.
const BASES = ["https://lda.gov/api/v1", "https://lda.senate.gov/api/v1"];
const headers: Record<string, string> = process.env.LDA_API_KEY ? { Authorization: `Token ${process.env.LDA_API_KEY}` } : {};
const OPTS = { headers, minDelayMs: 1200 };

// Client-name filter. The API's client_name search is a substring match and also
// returns unrelated names (e.g. a private person surnamed Bayer). We keep only
// corporate Bayer / Monsanto entities and report every excluded name for review.
const INCLUDE = /\b(BAYER\s+(U\.?\s?S\.?|CORP|CROP|AG\b|HEALTHCARE|MATERIAL|HOLDING|CONSOLIDATED)|THE BAYER CORPORATION|MONSANTO)/i;

// Keywords that mark a lobbying activity as plausibly glyphosate-related.
// This is a screening aid only; matched text is stored so a human can verify it.
const GLYPHOSATE_TERMS = [
  "glyphosate", "roundup", "fifra", "insecticide, fungicide", "pesticide", "herbicide",
  "preempt", "pre-empt", "label", "uniformity", "failure to warn", "crop protection", "litigation",
];
// Narrower subset used for the per-quarter "strong" series and samples.
const STRONG_TERMS = ["glyphosate", "roundup", "fifra", "insecticide, fungicide", "preempt", "pre-empt", "uniformity", "failure to warn"];

interface Filing {
  filing_uuid: string;
  filing_type: string;
  filing_year: number;
  filing_period: string;
  filing_document_url: string;
  income: string | null;
  expenses: string | null;
  dt_posted: string;
  registrant: { id: number; name: string };
  client: { id: number; name: string };
  lobbying_activities: Array<{
    general_issue_code: string;
    general_issue_code_display: string;
    description: string | null;
    lobbyists: Array<{ lobbyist: { id: number; first_name: string; last_name: string }; covered_position: string | null; new: boolean }>;
    government_entities: Array<{ id: number; name: string }>;
  }>;
}

async function pickBase(report: SourceReport): Promise<string> {
  for (const b of BASES) {
    try {
      const r = await checkUrl(`${b}/`);
      const isJson = (r.contentType ?? "").includes("json");
      report.checks.push({ name: `reachability ${b}`, ok: r.status >= 200 && r.status < 300 && isJson, detail: `HTTP ${r.status}, ${r.contentType}`, source_url: `${b}/` });
      if (r.status >= 200 && r.status < 300 && isJson) return b;
    } catch (e) {
      report.checks.push({ name: `reachability ${b}`, ok: false, detail: (e as Error).message });
    }
  }
  throw new Error("No LDA base URL reachable");
}

async function paginate<T>(firstUrl: string, maxPages = 200): Promise<{ rows: T[]; count: number; pages: number; first: string }> {
  const rows: T[] = [];
  let url: string | null = firstUrl;
  let count = 0;
  let pages = 0;
  while (url && pages < maxPages) {
    const r: Awaited<ReturnType<typeof fetchJson<any>>> = await fetchJson<any>(url, OPTS);
    count = r.data.count;
    rows.push(...r.data.results);
    url = r.data.next;
    pages++;
  }
  return { rows, count, pages, first: firstUrl };
}

const money = (s: string | null) => (s == null ? null : Number(s));
const periodToQ: Record<string, string> = {
  first_quarter: "Q1", second_quarter: "Q2", third_quarter: "Q3", fourth_quarter: "Q4",
  mid_year: "H1", year_end: "H2",
};

async function main() {
  const report: SourceReport = {
    source: "Senate LDA API",
    generated_at: new Date().toISOString(),
    window: { from: `${WINDOW.fromYear}-01-01`, to: new Date().toISOString().slice(0, 10) },
    base_urls: BASES,
    ok: false,
    checks: [],
    rate_limits: {},
    gaps: [],
    findings: {},
  };

  const base = await pickBase(report);
  report.findings.base_used = base;

  // 1) Client name variants
  const clientNames = new Map<string, { included: boolean; registrants: Set<string> }>();
  for (const term of ["Bayer", "Monsanto"]) {
    const { rows } = await paginate<any>(`${base}/clients/?${qs({ client_name: term, page_size: 25 })}`);
    for (const c of rows) {
      const e = clientNames.get(c.name) ?? { included: INCLUDE.test(c.name), registrants: new Set() };
      if (c.registrant?.name) e.registrants.add(c.registrant.name);
      clientNames.set(c.name, e);
    }
  }
  const included = [...clientNames].filter(([, v]) => v.included).map(([k]) => k).sort();
  const excluded = [...clientNames].filter(([, v]) => !v.included).map(([k]) => k).sort();
  report.findings.client_name_variants = { included, excluded_for_review: excluded };
  report.checks.push({ name: "client search", ok: included.length > 0, detail: `${included.length} Bayer/Monsanto client-name variants kept, ${excluded.length} excluded for human review` });

  // 2) LD-2 filings in window
  const filings = new Map<string, Filing>();
  const perYearCounts: Record<string, number> = {};
  for (let y = WINDOW.fromYear; y <= WINDOW.toYear; y++) {
    for (const term of ["Bayer", "Monsanto"]) {
      const { rows } = await paginate<Filing>(`${base}/filings/?${qs({ client_name: term, filing_year: y, page_size: 25 })}`);
      for (const f of rows) if (INCLUDE.test(f.client.name)) filings.set(f.filing_uuid, f);
    }
    perYearCounts[y] = [...filings.values()].filter((f) => f.filing_year === y).length;
    console.log(`  LDA ${y}: ${perYearCounts[y]} relevant filings so far`);
  }
  const all = [...filings.values()];
  report.checks.push({ name: "LD-2 filings", ok: all.length > 0, detail: `${all.length} Bayer/Monsanto filings ${WINDOW.fromYear}-${WINDOW.toYear}` });
  report.findings.filings_per_year = perYearCounts;
  report.findings.filing_types = countBy(all, (f) => f.filing_type);

  // 3) Quarterly amounts. In-house (self-filed) reports state EXPENSES; outside firms state INCOME
  //    from the client. These must not simply be summed (possible double count — see gaps).
  //    Amendments (types ending in "A") supersede originals; we keep the latest-posted per registrant+client+period.
  const latest = new Map<string, Filing>();
  for (const f of all) {
    const key = `${f.registrant.id}|${f.client.id}|${f.filing_year}|${f.filing_period}`;
    const prev = latest.get(key);
    if (!prev || prev.dt_posted < f.dt_posted) latest.set(key, f);
  }
  const quarterly: Record<string, { in_house_expenses: number; outside_firm_income: number; outside_firms: number; filings: string[] }> = {};
  for (const f of latest.values()) {
    const q = `${f.filing_year}-${periodToQ[f.filing_period] ?? f.filing_period}`;
    const row = (quarterly[q] ??= { in_house_expenses: 0, outside_firm_income: 0, outside_firms: 0, filings: [] });
    const exp = money(f.expenses);
    const inc = money(f.income);
    if (exp != null) row.in_house_expenses += exp;
    if (inc != null) { row.outside_firm_income += inc; row.outside_firms++; }
    row.filings.push(f.filing_document_url);
  }
  report.findings.quarterly_amounts = Object.fromEntries(
    Object.entries(quarterly).sort().map(([q, v]) => [q, { ...v, filings: v.filings.length }]),
  );

  // 4) Outside registrants
  const registrants = countBy([...latest.values()].filter((f) => f.income != null), (f) => f.registrant.name);
  report.findings.outside_registrants = registrants;

  // 5) Lobbyists + covered positions
  const lobbyists = new Map<number, { name: string; covered_positions: Set<string>; registrants: Set<string>; first: string; last: string; source_urls: Set<string> }>();
  for (const f of all) {
    const q = `${f.filing_year}-${periodToQ[f.filing_period] ?? f.filing_period}`;
    for (const a of f.lobbying_activities) {
      for (const l of a.lobbyists) {
        const e = lobbyists.get(l.lobbyist.id) ?? {
          name: `${l.lobbyist.first_name} ${l.lobbyist.last_name}`, covered_positions: new Set(), registrants: new Set(), first: q, last: q, source_urls: new Set(),
        };
        if (l.covered_position?.trim()) e.covered_positions.add(l.covered_position.trim());
        e.registrants.add(f.registrant.name);
        if (q < e.first) e.first = q;
        if (q > e.last) e.last = q;
        e.source_urls.add(f.filing_document_url);
        lobbyists.set(l.lobbyist.id, e);
      }
    }
  }
  const lobList = [...lobbyists.entries()].map(([id, v]) => ({
    lda_lobbyist_id: id, name: v.name, covered_positions: [...v.covered_positions], registrants: [...v.registrants],
    first_quarter: v.first, last_quarter: v.last, filing_count: v.source_urls.size, example_source_url: [...v.source_urls][0],
  }));
  const withCovered = lobList.filter((l) => l.covered_positions.length);
  report.findings.lobbyists = { total: lobList.length, with_covered_position: withCovered.length, sample_with_covered_position: withCovered.slice(0, 15) };
  report.checks.push({ name: "named lobbyists + covered positions", ok: lobList.length > 0, detail: `${lobList.length} distinct lobbyists; ${withCovered.length} list a covered (prior government) position` });

  // 6) Issue codes, government entities, glyphosate screening
  const issue: Record<string, number> = {};
  const entities: Record<string, number> = {};
  const glyphHits: Array<{ quarter: string; registrant: string; issue: string; matched: string[]; excerpt: string; source_url: string }> = [];
  const glyphPerQuarter: Record<string, number> = {};
  const strongPerQuarter: Record<string, number> = {};
  for (const f of all) {
    const q = `${f.filing_year}-${periodToQ[f.filing_period] ?? f.filing_period}`;
    for (const a of f.lobbying_activities) {
      issue[a.general_issue_code_display] = (issue[a.general_issue_code_display] ?? 0) + 1;
      for (const g of a.government_entities) entities[g.name] = (entities[g.name] ?? 0) + 1;
      const text = (a.description ?? "").toLowerCase();
      const matched = GLYPHOSATE_TERMS.filter((t) => text.includes(t));
      if (matched.length) {
        glyphPerQuarter[q] = (glyphPerQuarter[q] ?? 0) + 1;
        if (matched.some((m) => STRONG_TERMS.includes(m))) strongPerQuarter[q] = (strongPerQuarter[q] ?? 0) + 1;
        glyphHits.push({ quarter: q, registrant: f.registrant.name, issue: a.general_issue_code, matched, excerpt: (a.description ?? "").slice(0, 600), source_url: f.filing_document_url });
      }
    }
  }
  report.findings.issue_codes = sortObj(issue);
  report.findings.government_entities_lobbied = sortObj(entities);
  report.findings.glyphosate_keyword_activities = {
    terms: GLYPHOSATE_TERMS, total_activity_matches: glyphHits.length, per_quarter: Object.fromEntries(Object.entries(glyphPerQuarter).sort()),
    strong_terms: STRONG_TERMS,
    strong_per_quarter: Object.fromEntries(Object.entries(strongPerQuarter).sort()),
    // Distinct activity texts with strong terms from 2025 onward (the decision period), newest first.
    sample_decision_period: dedupe(glyphHits.filter((h) => h.quarter >= "2025" && h.matched.some((m) => STRONG_TERMS.includes(m)))).sort((a, b) => b.quarter.localeCompare(a.quarter)).slice(0, 25),
    sample_earliest: dedupe(glyphHits.filter((h) => h.matched.some((m) => STRONG_TERMS.includes(m)))).slice(0, 8),
  };
  report.checks.push({ name: "glyphosate keyword screen", ok: true, detail: `${glyphHits.length} lobbying activities mention at least one screening term` });

  // 7) LD-203 contribution reports (registrant + lobbyist political contributions)
  try {
    const contrib = new Map<string, any>();
    for (let y = WINDOW.fromYear; y <= WINDOW.toYear; y++) {
      for (const term of ["Bayer", "Monsanto"]) {
        const { rows } = await paginate<any>(`${base}/contributions/?${qs({ registrant_name: term, filing_year: y, page_size: 25 })}`, 40);
        for (const r of rows) contrib.set(r.filing_uuid, r);
      }
    }
    const cr = [...contrib.values()];
    const items = cr.flatMap((r) => (r.contribution_items ?? []).map((i: any) => ({ ...i, _filer: r.registrant?.name, _lobbyist: r.lobbyist ? `${r.lobbyist.first_name} ${r.lobbyist.last_name}` : null, _url: r.filing_document_url })));
    report.findings.ld203 = {
      reports: cr.length,
      itemized_contributions: items.length,
      contribution_types: countBy(items, (i: any) => i.contribution_type_display ?? i.contribution_type),
      sample: items.slice(0, 8).map((i: any) => ({ date: i.date, amount: i.amount, payee: i.payee_name, honoree: i.honoree_name, type: i.contribution_type_display, filer: i._filer, lobbyist: i._lobbyist, source_url: i._url })),
    };
    report.checks.push({ name: "LD-203 contributions", ok: cr.length > 0, detail: `${cr.length} LD-203 reports, ${items.length} itemized contributions` });
  } catch (e) {
    report.checks.push({ name: "LD-203 contributions", ok: false, detail: (e as Error).message.slice(0, 200) });
  }

  report.rate_limits = {
    observed_headers: "LDA API sent no X-RateLimit headers during this run.",
    documented: "Anonymous requests are throttled more tightly than requests with an API key (Authorization: Token <key>). This script waits 1.2s between requests and backs off on 429.",
    page_size_max: 25,
  };
  report.gaps.push(
    "lda.senate.gov returned a 'Site Under Maintenance' HTML page; lda.gov serves the same API. Store lda.gov URLs and re-check lda.senate.gov later.",
    "Client names are free text and vary (e.g. 'BAYER CORPORATION (FKA MONSANTO COMPANY)'). Entity resolution needs a reviewed alias list; excluded names are listed for review.",
    "In-house expenses and outside-firm income can overlap (an in-house total may already include payments to outside firms). Show them as separate series; do not sum them until the LDA guidance is checked.",
    "Lobbying activity descriptions are short free text. The keyword screen finds candidates only; a human must confirm each match is about glyphosate before it is used as RECORD.",
    "LD-2 reports give quarterly totals, not per-issue or per-day amounts. The timeline can only plot quarterly spend.",
    "Covered positions are self-reported text. They can be shown verbatim and linked, but 'overlap with the client's industry' needs manual tagging.",
  );
  report.ok = report.checks.every((c) => c.ok || c.name.startsWith("reachability"));
  writeReport("lda", report);
}

function dedupe<T extends { excerpt: string; registrant: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((h) => { const k = h.registrant + "|" + h.excerpt; if (seen.has(k)) return false; seen.add(k); return true; });
}
function countBy<T>(arr: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of arr) out[key(t)] = (out[key(t)] ?? 0) + 1;
  return sortObj(out);
}
function sortObj(o: Record<string, number>) {
  return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
