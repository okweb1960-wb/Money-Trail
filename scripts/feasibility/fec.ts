// Phase 0 feasibility: OpenFEC API.
// Tests: Bayer/Monsanto-affiliated PACs, their contributions to candidates and
// committees (with dates), and employee contributions by employer name.
//
// Run: npx tsx scripts/feasibility/fec.ts
// Needs FEC_API_KEY in .env.local (falls back to DEMO_KEY, heavily rate-limited).
// The key is sent in the X-Api-Key header, never in the URL, so stored source URLs are key-free.

import { fetchJson, qs } from "../lib/http";
import { writeReport, WINDOW, type SourceReport } from "../lib/report";

const BASE = "https://api.open.fec.gov/v1";
const KEY = process.env.FEC_API_KEY || "DEMO_KEY";
const OPTS = { headers: { "X-Api-Key": KEY }, minDelayMs: 300, retries: 6 };

const cycles: number[] = [];
for (let y = WINDOW.fromYear; y <= WINDOW.toYear + 1; y++) if (y % 2 === 0) cycles.push(y);

const AFFILIATION = /\b(BAYER|MONSANTO)\b/i;
// Employer strings are donor-typed. Keep corporate Bayer/Monsanto forms; everything else
// (e.g. unrelated businesses with "Bayer" in the name) is excluded and listed for review.
const EMPLOYER_INCLUDE = /^(THE )?(BAYER( (U\.?S\.?|USA|CORP\w*|CROP ?SCIENCE|CROP|CORP ?SCIENCE|AG|HEALTH ?CARE|HEALTH|PHARMA\w*|CONSUMER HEALTH|ANIMAL HEALTH|INC|LLC|CROPSCIENCE LP( USA)?|INTERNATIONAL TRADE|CHEMICAL|LYMPHOMA FRANCHISE)\b.*)?|MONSANTO( CO\.?| COMPANY|\/BAYER| CHEMIST)?)[ ,.]*$/i;

async function main() {
  const report: SourceReport = {
    source: "OpenFEC API",
    generated_at: new Date().toISOString(),
    window: { from: `${WINDOW.fromYear}-01-01`, to: new Date().toISOString().slice(0, 10) },
    base_urls: [BASE],
    ok: false,
    checks: [],
    rate_limits: {},
    gaps: [],
    findings: {},
  };
  report.findings.key_mode = KEY === "DEMO_KEY" ? "DEMO_KEY" : "personal key (value not recorded)";

  // 1) Committees
  const committees = new Map<string, any>();
  let rl: any;
  for (const q of ["bayer", "monsanto"]) {
    const r = await fetchJson<any>(`${BASE}/committees/?${qs({ q, per_page: 100 })}`, OPTS);
    rl = r.rateLimit;
    for (const c of r.data.results) committees.set(c.committee_id, c);
  }
  const pacs = [...committees.values()].filter((c) => c.committee_type === "Q" || c.committee_type === "N" || /PAC/.test(c.committee_type_full));
  report.findings.committees_found = [...committees.values()].map((c) => ({
    committee_id: c.committee_id, name: c.name, type: c.committee_type_full, designation: c.designation_full,
    cycles: c.cycles, source_url: `https://www.fec.gov/data/committee/${c.committee_id}/`,
  }));
  report.checks.push({ name: "affiliated committees", ok: pacs.length > 0, detail: `${committees.size} committees match; ${pacs.length} are PACs` });

  // 2) PAC totals by cycle + itemized disbursements to candidates/committees
  const pacFindings: any[] = [];
  for (const pac of pacs) {
    // Name history: shows predecessor names (e.g. a pre-merger PAC renamed after an acquisition)
    // and filing_frequency "T" = terminated.
    const hist = await fetchJson<any>(`${BASE}/committee/${pac.committee_id}/history/?${qs({ per_page: 50 })}`, OPTS);
    const names: Array<{ name: string; cycles: number[]; affiliated: string | null }> = [];
    for (const h of [...hist.data.results].sort((a: any, b: any) => a.cycle - b.cycle)) {
      const last = names[names.length - 1];
      if (last && last.name === h.name) last.cycles.push(h.cycle);
      else names.push({ name: h.name, cycles: [h.cycle], affiliated: h.affiliated_committee_name ?? null });
    }
    const latestHist = hist.data.results[0];
    const historyFinding = {
      name_history: names.map((n) => ({ name: n.name, affiliated: n.affiliated, first_cycle: n.cycles[0], last_cycle: n.cycles[n.cycles.length - 1] })),
      terminated: latestHist?.filing_frequency === "T",
      last_file_date: latestHist?.last_file_date ?? null,
      history_source_url: hist.url,
    };
    const activeCycles = (pac.cycles as number[]).filter((c) => c >= WINDOW.fromYear);
    if (!activeCycles.length) {
      pacFindings.push({ committee_id: pac.committee_id, name: pac.name, ...historyFinding, note: `no activity cycles >= ${WINDOW.fromYear}` });
      continue;
    }
    const totals = await fetchJson<any>(`${BASE}/committee/${pac.committee_id}/totals/?${qs({ per_page: 20 })}`, OPTS);
    const byCycle = totals.data.results
      .filter((t: any) => t.cycle >= WINDOW.fromYear)
      .map((t: any) => ({ cycle: t.cycle, receipts: t.receipts, disbursements: t.disbursements, contributions_to_other_committees: t.contributions_to_other_committees ?? t.fed_candidate_committee_contributions ?? null }));

    const disb: any[] = [];
    let timeouts = 0;
    for (const cycle of activeCycles) {
      let last: Record<string, string> = {};
      for (let page = 0; page < 40; page++) {
        let r;
        try {
          r = await fetchJson<any>(`${BASE}/schedules/schedule_b/?${qs({ committee_id: pac.committee_id, two_year_transaction_period: cycle, per_page: 100, ...last })}`, OPTS);
        } catch {
          timeouts++;
          break;
        }
        disb.push(...r.data.results);
        const li = r.data.pagination.last_indexes;
        if (!li || r.data.results.length < 100) break;
        last = { last_index: li.last_index, last_disbursement_date: li.last_disbursement_date };
      }
    }
    // Contributions to federal candidates / political committees (vs. admin expenses)
    const toPolitical = disb.filter((d) => d.recipient_committee_id || d.candidate_id || /CONTRIBUTION/i.test(d.disbursement_description ?? ""));
    const withCandidate = toPolitical.filter((d) => d.candidate_id || d.candidate_name);
    const affiliatedTransfers = toPolitical.filter((d) => AFFILIATION.test(d.recipient_name ?? ""));
    const nonFederal = toPolitical.filter((d) => !d.recipient_committee_id && !d.candidate_id);
    const recipients: Record<string, number> = {};
    for (const d of toPolitical) recipients[d.recipient_name] = (recipients[d.recipient_name] ?? 0) + (d.disbursement_amount ?? 0);
    pacFindings.push({
      committee_id: pac.committee_id,
      name: pac.name,
      ...historyFinding,
      totals_by_cycle: byCycle,
      totals_source_url: totals.url,
      itemized_disbursements: disb.length,
      to_candidates_or_committees: toPolitical.length,
      with_candidate_id: withCandidate.length,
      transfers_to_affiliated_committees: affiliatedTransfers.length,
      recipients_without_fec_committee_id_likely_state_or_local: nonFederal.length,
      has_dates: toPolitical.filter((d) => d.disbursement_date).length,
      has_pdf_url: toPolitical.filter((d) => d.pdf_url).length,
      date_range: range(toPolitical.map((d) => d.disbursement_date).filter(Boolean)),
      top_recipients_by_amount: Object.entries(recipients).sort((a, b) => b[1] - a[1]).slice(0, 10),
      sample: toPolitical.slice(0, 5).map((d) => ({
        date: d.disbursement_date, amount: d.disbursement_amount, recipient: d.recipient_name, recipient_committee_id: d.recipient_committee_id,
        candidate: d.candidate_name, candidate_id: d.candidate_id, office: d.candidate_office, state: d.candidate_office_state, pdf_url: d.pdf_url,
      })),
      query_timeouts_after_retries: timeouts,
    });
    report.checks.push({ name: `PAC disbursements ${pac.committee_id}`, ok: disb.length > 0, detail: `${disb.length} itemized disbursements, ${toPolitical.length} to candidates/committees, cycles ${activeCycles.join(",")}${timeouts ? `, ${timeouts} cycle queries failed after retries` : ""}` });
  }
  report.findings.pacs = pacFindings;

  // 3) Employee contributions: aggregate by employer string per cycle
  const employer: any[] = [];
  const employerExcluded = new Set<string>();
  for (const cycle of cycles) {
    for (const e of ["bayer", "monsanto"]) {
      try {
        const r = await fetchJson<any>(`${BASE}/schedules/schedule_a/by_employer/?${qs({ employer: e, cycle, per_page: 100, sort: "-total" })}`, OPTS);
        for (const row of r.data.results) {
          if (!AFFILIATION.test(row.employer ?? "")) continue;
          if (EMPLOYER_INCLUDE.test((row.employer ?? "").trim())) employer.push({ cycle, employer: row.employer, total: row.total, count: row.count, source_url: r.url });
          else employerExcluded.add(row.employer);
        }
      } catch (err) {
        report.gaps.push(`by_employer ${e} ${cycle} failed: ${(err as Error).message.slice(0, 120)}`);
      }
    }
  }
  const empByCycle: Record<number, { total: number; count: number; employer_strings: number }> = {};
  for (const r of employer) {
    const c = (empByCycle[r.cycle] ??= { total: 0, count: 0, employer_strings: 0 });
    c.total += r.total; c.count += r.count; c.employer_strings++;
  }
  report.findings.employee_contributions_by_employer = {
    by_cycle: empByCycle,
    distinct_employer_strings_kept: [...new Set(employer.map((r) => r.employer))].slice(0, 60),
    employer_strings_excluded_for_review: [...employerExcluded].slice(0, 60),
    caution: "Totals include contributions to the company's own PAC and to conduits (ActBlue/WinRed); they are not money to officials.",
  };

  // 4) Itemized sample of employee contributions (dates + recipients), one cycle
  try {
    const r = await fetchJson<any>(`${BASE}/schedules/schedule_a/?${qs({ contributor_employer: "bayer", two_year_transaction_period: 2024, is_individual: true, per_page: 100 })}`, OPTS);
    const rows = r.data.results;
    const toOwnPac = rows.filter((x: any) => AFFILIATION.test(x.committee?.name ?? "")).length;
    const unrelated = rows.filter((x: any) => !AFFILIATION.test(x.contributor_employer ?? "")).length;
    report.findings.employee_itemized_sample_2024 = {
      total_matching_rows: r.data.pagination.count,
      sample_size: rows.length,
      share_to_affiliated_pac: `${toOwnPac}/${rows.length}`,
      employer_text_not_matching_bayer: unrelated,
      examples: rows.slice(0, 5).map((x: any) => ({ date: x.contribution_receipt_date, amount: x.contribution_receipt_amount, employer: x.contributor_employer, occupation: x.contributor_occupation, recipient: x.committee?.name, pdf_url: x.pdf_url })),
      source_url: r.url,
    };
    report.checks.push({ name: "employee itemized contributions", ok: rows.length > 0, detail: `${r.data.pagination.count} itemized 2023-24 receipts match employer 'bayer'; ${toOwnPac} of the ${rows.length} sampled went to an affiliated PAC` });
  } catch (e) {
    report.checks.push({ name: "employee itemized contributions", ok: false, detail: (e as Error).message.slice(0, 200) });
  }

  report.rate_limits = {
    observed_x_ratelimit_limit: rl?.limit,
    observed_x_ratelimit_remaining_at_start: rl?.remaining,
    note: "api.data.gov enforces per-key hourly limits; DEMO_KEY is far lower. Itemized schedule_a/schedule_b queries intermittently return 504 'Query timed out' and need retries. Pagination is keyset (last_index + last_<date>), not page numbers.",
  };
  report.gaps.push(
    "Employer is free text typed by donors ('BAYER', 'BAYER CROP SCIENCE', 'BAYER US LLC', 'SELF'...). The 'bayer' search is fuzzy and can include unrelated employers; matches need an alias list and review.",
    "Most employee contributions go to the company's own PAC via payroll deduction. Counting them as money to officials would double count with PAC disbursements; the PAC's contributions to candidates are the cleaner signal.",
    "FEC itemizes individual receipts only above $200 per election cycle; smaller donations are not attributable.",
    "Contributions are linked to candidates/committees, not to decisions. The app can show timing only (e.g. a contribution date before/after a decision) and must not imply a link.",
    "Executive-branch officials (EPA, USDA, White House, DOJ) are not FEC candidates. Contributions can only be linked to them via a campaign committee or party committee, which needs careful wording.",
  );
  report.ok = report.checks.every((c) => c.ok);
  writeReport("fec", report);
}

function range(dates: string[]) {
  if (!dates.length) return null;
  const s = [...dates].sort();
  return { first: s[0].slice(0, 10), last: s[s.length - 1].slice(0, 10) };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
