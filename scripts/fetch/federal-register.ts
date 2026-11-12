// Fetch Federal Register metadata for the case's executive order(s) (found by search, not hardcoded).
// Writes data/raw/federal-register/executive-orders.json.
// Note: the Federal Register may block shared/cloud IPs; run locally if you see HTTP 403.
// Run: npm run fetch:fr
import { fetchJson, qs } from "../lib/http";
import { writeRaw } from "../lib/raw";
import { loadCase } from "../lib/case";

const BASE = "https://www.federalregister.gov/api/v1";
const FIELDS = ["title", "type", "subtype", "document_number", "publication_date", "signing_date", "executive_order_number", "citation", "html_url", "pdf_url", "full_text_xml_url", "raw_text_url", "president", "executive_order_notes", "abstract"];

async function main() {
  const c = loadCase();
  const s = await fetchJson<any>(`${BASE}/documents.json?${qs({ "conditions[term]": c.federal_register.search_term, "conditions[type][]": c.federal_register.type, per_page: 100, "fields[]": FIELDS })}`, { minDelayMs: 500 });
  const eos = (s.data.results ?? []).filter((d: any) => d.subtype === c.federal_register.subtype);
  const out: any[] = [];
  for (const eo of eos) {
    const d = await fetchJson<any>(`${BASE}/documents/${eo.document_number}.json?${qs({ "fields[]": FIELDS })}`, { minDelayMs: 500 });
    let text: string | null = null;
    try {
      const t = await fetch(d.data.raw_text_url, { signal: AbortSignal.timeout(60_000) });
      if (t.ok && (t.headers.get("content-type") ?? "").includes("text")) text = await t.text();
    } catch { /* blocked or unavailable: leave null */ }
    out.push({ ...d.data, _source_url: d.url, _retrieved_at: d.retrieved_at, _raw_text: text });
    console.log(`  EO ${d.data.executive_order_number}: ${d.data.title} (full text ${text ? "saved" : "NOT available"})`);
  }
  writeRaw("federal-register/executive-orders.json", { source: "Federal Register API", retrieved_at: s.retrieved_at, requests: [{ url: s.url, retrieved_at: s.retrieved_at }], data: out });
}

main().catch((e) => { console.error(e); process.exit(1); });
