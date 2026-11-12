// Fetch Senate LDA records for the case company: LD-2 filings and the company's own LD-203s.
// Writes data/raw/lda/filings.json and data/raw/lda/contributions.json.
// Run: npm run fetch:lda   (about 6 minutes; anonymous access is throttled)
import { fetchJson, qs } from "../lib/http";
import { writeRaw } from "../lib/raw";
import { loadCase, CURRENT_YEAR } from "../lib/case";

const BASE = "https://lda.gov/api/v1"; // lda.senate.gov showed a maintenance page in Phase 0
const headers: Record<string, string> = process.env.LDA_API_KEY ? { Authorization: `Token ${process.env.LDA_API_KEY}` } : {};
const OPTS = { headers, minDelayMs: 1200 };

async function paginate(first: string, requests: Array<{ url: string; retrieved_at: string }>) {
  const rows: any[] = [];
  let url: string | null = first;
  while (url) {
    const r: any = await fetchJson<any>(url, OPTS);
    requests.push({ url, retrieved_at: r.retrieved_at });
    rows.push(...r.data.results);
    url = r.data.next;
  }
  return rows;
}

async function main() {
  const c = loadCase();
  const started = new Date().toISOString();
  const reqF: Array<{ url: string; retrieved_at: string }> = [];
  const filings = new Map<string, any>();
  for (let y = c.window_from_year; y <= CURRENT_YEAR; y++) {
    for (const term of c.lda_client_search_terms) {
      for (const f of await paginate(`${BASE}/filings/?${qs({ client_name: term, filing_year: y, page_size: 25 })}`, reqF)) {
        f._retrieved_at = reqF[reqF.length - 1].retrieved_at;
        filings.set(f.filing_uuid, f);
      }
    }
    console.log(`  LD-2 ${y}: ${filings.size} total so far`);
  }
  writeRaw("lda/filings.json", { source: "Senate LDA API (lda.gov)", retrieved_at: started, requests: reqF, data: [...filings.values()] });

  const reqC: Array<{ url: string; retrieved_at: string }> = [];
  const contribs = new Map<string, any>();
  for (let y = c.window_from_year; y <= CURRENT_YEAR; y++) {
    for (const term of c.lda_client_search_terms) {
      for (const r of await paginate(`${BASE}/contributions/?${qs({ registrant_name: term, filing_year: y, page_size: 25 })}`, reqC)) {
        r._retrieved_at = reqC[reqC.length - 1].retrieved_at;
        contribs.set(r.filing_uuid, r);
      }
    }
  }
  writeRaw("lda/contributions.json", { source: "Senate LDA API (lda.gov) LD-203", retrieved_at: started, requests: reqC, data: [...contribs.values()] });
}

main().catch((e) => { console.error(e); process.exit(1); });
