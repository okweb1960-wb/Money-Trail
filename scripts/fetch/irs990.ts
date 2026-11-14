// IRS Form 990 data for each organization that filed an amicus brief, via ProPublica's
// Nonprofit Explorer API (which republishes IRS e-file data and links the original filings).
// Writes data/raw/irs990/amicus-orgs.json.
//
// What a 990 shows: revenue (incl. contributions & grants, program-service revenue such as dues),
// expenses, assets, officer pay, tax-exempt type. What it does NOT show publicly: donor names
// (Schedule B donor names are withheld from public copies for most organizations).
//
// Run: npm run fetch:990
import { fetchJson, qs } from "../lib/http";
import { readRaw, writeRaw } from "../lib/raw";
import { loadCase } from "../lib/case";
import { searchName } from "./amicus-lda";

/** Strict IRS name match: identical words, ignoring only "The", "Inc", "Incorporated", "et al." and punctuation. */
export function sameOrgStrict(irsName: string, filer: string) {
  const canon = (x: string) =>
    x.toUpperCase().replace(/[’'`]/g, "").replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((w) => w && !["THE", "INC", "INCORPORATED", "ET", "AL"].includes(w)).join(" ");
  return canon(irsName) !== "" && canon(irsName) === canon(filer);
}

const BASE = "https://projects.propublica.org/nonprofits/api/v2";
const OPTS = { minDelayMs: 700 };

async function main() {
  const c = loadCase();
  const briefs = readRaw<any[]>("scotus/amicus-briefs.json").data;
  const exclude = (c.amicus?.exclude ?? []).map((x) => new RegExp(x.pattern, "i"));
  const officials = c.officials.filter((o) => o.docketMatch).map((o) => new RegExp(o.docketMatch!, "i"));
  const names = [...new Set(briefs.map((b) => b.filer as string))].filter(
    (f) => !exclude.some((re) => re.test(f)) && !officials.some((re) => re.test(`Brief amicus curiae of ${f} filed`) || re.test(`Brief amici curiae of ${f} filed`)),
  );
  const requests: Array<{ url: string; retrieved_at: string }> = [];
  const out: any[] = [];
  for (const filer of names) {
    const term = searchName(filer);
    const variants = [...new Set([term, term.replace(/[’`]/g, "'"), term.replace(/[’'`]/g, "")])];
    const candidates = new Map<number, any>();
    for (const v of variants) {
      const url = `${BASE}/search.json?${qs({ q: v })}`;
      try {
        const r = await fetchJson<any>(url, OPTS);
        requests.push({ url, retrieved_at: r.retrieved_at });
        for (const o of r.data.organizations ?? []) if (sameOrgStrict(o.name ?? "", filer)) candidates.set(o.ein, o);
      } catch (e) {
        // ProPublica returns 404 when a search has no results
        if (!String((e as Error).message).includes("404")) throw e;
      }
    }
    if (candidates.size !== 1) {
      out.push({ filer, status: candidates.size === 0 ? "not_found" : "ambiguous", candidates: [...candidates.values()].map((o) => ({ ein: o.ein, name: o.name, city: o.city, state: o.state })) });
      console.log(`  ${filer.slice(0, 50).padEnd(50)} ${candidates.size === 0 ? "not found" : `ambiguous (${candidates.size})`}`);
      continue;
    }
    const ein = [...candidates.keys()][0];
    const url = `${BASE}/organizations/${ein}.json`;
    const r = await fetchJson<any>(url, OPTS);
    requests.push({ url, retrieved_at: r.retrieved_at });
    const org = r.data.organization;
    const filings = (r.data.filings_with_data ?? []).sort((a: any, b: any) => b.tax_prd - a.tax_prd);
    const latest = filings[0];
    out.push({
      filer, status: "matched", ein, name: org.name, city: org.city, state: org.state,
      subsection: org.subsection_code, // 3 = 501(c)(3) charity, 4 = 501(c)(4), 5 = 501(c)(5) labor/agricultural, 6 = 501(c)(6) business league
      orgPage: `https://projects.propublica.org/nonprofits/organizations/${ein}`,
      latest: latest
        ? {
            taxPeriod: latest.tax_prd, taxYear: latest.tax_prd_yr, formType: latest.formtype,
            totalRevenue: latest.totrevenue, contributionsAndGrants: latest.totcntrbgfts, programServiceRevenue: latest.totprgmrevnue,
            membershipDues: latest.duesassesmnts ?? null, investmentIncome: latest.invstmntinc, totalExpenses: latest.totfuncexpns,
            totalAssets: latest.totassetsend, officerCompensation: latest.compnsatncurrofcr, pdfUrl: latest.pdf_url,
          }
        : null,
      history: filings.slice(0, 6).map((f: any) => ({ taxYear: f.tax_prd_yr, totalRevenue: f.totrevenue, contributionsAndGrants: f.totcntrbgfts })),
      retrieved_at: r.retrieved_at,
    });
    console.log(`  ${filer.slice(0, 50).padEnd(50)} EIN ${ein} ${org.name} | ${latest ? `${latest.tax_prd_yr}: revenue $${Number(latest.totrevenue).toLocaleString()}, contributions $${Number(latest.totcntrbgfts).toLocaleString()}` : "no financial data"}`);
  }
  writeRaw("irs990/amicus-orgs.json", { source: "IRS Form 990 via ProPublica Nonprofit Explorer API", retrieved_at: new Date().toISOString(), requests, data: out });
}

if (process.argv[1]?.endsWith("irs990.ts")) main().catch((e) => { console.error(e); process.exit(1); });
