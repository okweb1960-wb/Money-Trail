// Fetch FEC records: company PAC committee history + itemized disbursements, and
// FEC candidate records for officials named in the case config.
// Writes data/raw/fec/*.json.  Needs FEC_API_KEY in .env.local (sent as X-Api-Key, never in URLs).
// Run: npm run fetch:fec
import { fetchJson, qs } from "../lib/http";
import { writeRaw } from "../lib/raw";
import { loadCase, CURRENT_YEAR } from "../lib/case";

const BASE = "https://api.open.fec.gov/v1";
const OPTS = { headers: { "X-Api-Key": process.env.FEC_API_KEY || "DEMO_KEY" }, minDelayMs: 300, retries: 6 };

// Keep only the fields the loader and the UI use (keeps the committed snapshot small).
export const DISB_FIELDS = ["sub_id", "transaction_id", "memo_code", "disbursement_date", "disbursement_amount", "disbursement_description", "recipient_name", "recipient_committee_id", "recipient_state", "candidate_id", "candidate_name", "candidate_office", "candidate_office_state", "entity_type", "pdf_url", "image_number", "report_year", "report_type"];
const pick = (d: any) => Object.fromEntries(DISB_FIELDS.map((k) => [k, d[k] ?? null]));

async function main() {
  const c = loadCase();
  const started = new Date().toISOString();
  const requests: Array<{ url: string; retrieved_at: string }> = [];
  const get = async (url: string) => {
    const r = await fetchJson<any>(url, OPTS);
    requests.push({ url, retrieved_at: r.retrieved_at });
    return r;
  };

  const committees: any[] = [];
  for (const id of c.fec_committee_ids) {
    const info = await get(`${BASE}/committee/${id}/`);
    const hist = await get(`${BASE}/committee/${id}/history/?${qs({ per_page: 50 })}`);
    const totals = await get(`${BASE}/committee/${id}/totals/?${qs({ per_page: 20 })}`);
    const cycles: number[] = (info.data.results[0]?.cycles ?? []).filter((y: number) => y >= c.window_from_year);
    const disb: any[] = [];
    for (const cycle of cycles) {
      let last: Record<string, string> = {};
      for (let page = 0; page < 60; page++) {
        const url = `${BASE}/schedules/schedule_b/?${qs({ committee_id: id, two_year_transaction_period: cycle, per_page: 100, ...last })}`;
        const r = await get(url);
        for (const d of r.data.results) disb.push({ ...pick(d), _source_url: url, _retrieved_at: r.retrieved_at });
        const li = r.data.pagination.last_indexes;
        if (!li || r.data.results.length < 100) break;
        last = { last_index: li.last_index, last_disbursement_date: li.last_disbursement_date };
      }
    }
    console.log(`  ${id}: ${disb.length} disbursements`);
    committees.push({ committee: info.data.results[0], committee_url: info.url, history: hist.data.results, history_url: hist.url, totals: totals.data.results, totals_url: totals.url, disbursements: disb });
  }

  // FEC candidate records for officials in the case config (by name + office).
  const candidates: any[] = [];
  for (const o of c.officials.filter((x) => x.fec)) {
    const r = await get(`${BASE}/candidates/search/?${qs({ name: o.fec!.name, office: o.fec!.office, per_page: 20 })}`);
    candidates.push({ official_id: o.id, query_url: r.url, retrieved_at: r.retrieved_at, results: r.data.results });
  }

  writeRaw("fec/committees.json", { source: "OpenFEC API", retrieved_at: started, requests, data: committees });
  writeRaw("fec/candidates.json", { source: "OpenFEC API", retrieved_at: started, requests: [], data: candidates });
  void CURRENT_YEAR;
}

main().catch((e) => { console.error(e); process.exit(1); });
