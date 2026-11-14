// For each organization that filed an amicus brief, look it up in the Senate LDA database
// (an approved source) for the case window's last two years:
//  - does it report its own lobbying (as client), and how much?
//  - does any of its filings list the case company among "affiliated organizations"?
// Writes data/raw/lda/amicus-orgs.json.
// Run: npm run fetch:amicus-lda
import { fetchJson, qs } from "../lib/http";
import { readRaw, writeRaw } from "../lib/raw";
import { loadCase, CURRENT_YEAR } from "../lib/case";

const BASE = "https://lda.gov/api/v1";
const OPTS = { headers: (process.env.LDA_API_KEY ? { Authorization: `Token ${process.env.LDA_API_KEY}` } : {}) as Record<string, string>, minDelayMs: 1200 };

/** Search term for an amicus filer name: drop "et al." and leading "the". */
export function searchName(filer: string) {
  return filer.replace(/,?\s*et al\.?$/i, "").replace(/^the\s+/i, "").replace(/,?\s*Inc\.?$/i, "").trim();
}

const DROP = new Set(["THE", "OF", "US", "U", "S", "A", "USA", "UNITED", "STATES", "AMERICA", "INC", "LLC", "ET", "AL", "AND"]);
const canon = (x: string) => x.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !DROP.has(w));
/** Same organization: same number of significant words, each LDA word equal to or an abbreviation (prefix) of the filer's word. */
export function sameOrg(ldaName: string, filer: string) {
  const a = canon(ldaName), b = canon(filer);
  return a.length > 0 && a.length === b.length && a.every((w, i) => b[i].startsWith(w));
}

async function main() {
  const c = loadCase();
  const briefs = readRaw<any[]>("scotus/amicus-briefs.json").data;
  const exclude = (c.amicus?.exclude ?? []).map((x) => new RegExp(x.pattern, "i"));
  const officials = c.officials.filter((o) => o.docketMatch).map((o) => new RegExp(o.docketMatch!, "i"));
  const names = [...new Set(briefs.map((b) => b.filer as string))].filter((f) => !exclude.some((re) => re.test(f)) && !officials.some((re) => re.test(`Brief amicus curiae of ${f} filed`) || re.test(`Brief amici curiae of ${f} filed`)));
  const company = new RegExp(`\\b(${[c.scotus.expect_petitioner, ...(c.scotus.related_parties ?? [])].join("|")})\\b`, "i");
  const requests: Array<{ url: string; retrieved_at: string }> = [];
  const out: any[] = [];
  for (const filer of names) {
    const term = searchName(filer);
    // Name variants: the full name, and a short form without "of the United States (of America)".
    const short = term.replace(/ of the United States( of America)?$/i, "").trim();
    const firstWords = short.split(/\s+/).slice(0, 3).join(" "); // LDA names are sometimes truncated ("AMERICAN FARM BUREAU FED")
    const seen = new Map<string, any>();
    // LDA also abbreviates "United States (of America)" as "U.S.A." / "U.S."
    const abbrev = term.replace(/United States of America/i, "U.S.A.").replace(/United States/i, "U.S.");
    for (const v of [...new Set([term, short, firstWords, abbrev])]) {
      for (const field of ["client_name", "registrant_name"]) {
        for (const year of [CURRENT_YEAR - 1, CURRENT_YEAR]) {
          let url: string | null = `${BASE}/filings/?${qs({ [field]: v, filing_year: year, page_size: 25 })}`;
          for (let page = 0; url && page < 4; page++) {
            const r: any = await fetchJson<any>(url, OPTS);
            requests.push({ url, retrieved_at: r.retrieved_at });
            for (const f of r.data.results) seen.set(f.filing_uuid, f);
            url = r.data.next;
          }
        }
      }
    }
    // Keep filings where this organization is the CLIENT (it pays for the lobbying), using a strict name match.
    const own = [...seen.values()].filter((f) => sameOrg(f.client.name, filer));
    const affiliated = own.flatMap((f) => (f.affiliated_organizations ?? []).map((a: any) => ({ name: a.name, filing: f.filing_document_url })));
    const companyAffiliations = affiliated.filter((a) => company.test(a.name));
    const inHouse = own.filter((f) => f.expenses != null);
    const latestPerQuarter = new Map<string, any>();
    for (const f of inHouse) {
      const k = `${f.registrant.id}|${f.filing_year}|${f.filing_period}`;
      if (!latestPerQuarter.has(k) || latestPerQuarter.get(k).dt_posted < f.dt_posted) latestPerQuarter.set(k, f);
    }
    const reportedExpenses = [...latestPerQuarter.values()].reduce((s, f) => s + Number(f.expenses ?? 0), 0);
    const outside = new Map<string, any>();
    for (const f of own.filter((x) => x.income != null)) {
      const k = `${f.registrant.id}|${f.client.id}|${f.filing_year}|${f.filing_period}`;
      if (!outside.has(k) || outside.get(k).dt_posted < f.dt_posted) outside.set(k, f);
    }
    const outsideIncome = [...outside.values()].reduce((s, f) => s + Number(f.income ?? 0), 0);
    out.push({
      filer, searchTerm: term, filingsFound: own.length,
      clientNames: [...new Set(own.map((f) => f.client.name))].slice(0, 5),
      inHouseQuarters: latestPerQuarter.size, reportedInHouseExpenses: reportedExpenses,
      outsideFirmIncome: outsideIncome, outsideFirms: [...new Set([...outside.values()].map((f) => f.registrant.name))].slice(0, 20),
      years: [CURRENT_YEAR - 1, CURRENT_YEAR],
      affiliatedOrganizations: [...new Set(affiliated.map((a) => a.name))].slice(0, 40),
      companyListedAsAffiliated: companyAffiliations.slice(0, 5),
      exampleFiling: own[0]?.filing_document_url ?? null,
    });
    console.log(`  ${filer.slice(0, 45).padEnd(45)} filings ${String(own.length).padStart(3)} | in-house $${reportedExpenses.toLocaleString()} | outside $${outsideIncome.toLocaleString()} | ${[...new Set(own.map((f) => f.client.name))].slice(0, 2).join(" / ")} | affiliated ${affiliated.length}${companyAffiliations.length ? " | LISTS " + companyAffiliations[0].name : ""}`);
  }
  writeRaw("lda/amicus-orgs.json", { source: "Senate LDA API (lda.gov)", retrieved_at: new Date().toISOString(), requests, data: out });
}

if (process.argv[1]?.endsWith("amicus-lda.ts")) main().catch((e) => { console.error(e); process.exit(1); });
