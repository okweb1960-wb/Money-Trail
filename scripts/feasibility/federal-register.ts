// Phase 0 feasibility: Federal Register API.
// Finds the glyphosate-related executive order from the API itself (no hardcoded
// title/date/number), then fetches its full metadata and documents that cite it.
//
// Run: npx tsx scripts/feasibility/federal-register.ts

import { fetchJson, checkUrl, qs } from "../lib/http";
import { writeReport, WINDOW, type SourceReport } from "../lib/report";

const BASE = "https://www.federalregister.gov/api/v1";
const OPTS = { minDelayMs: 300 };
const FIELDS = [
  "title", "type", "subtype", "document_number", "publication_date", "signing_date", "executive_order_number",
  "presidential_document_number", "citation", "start_page", "html_url", "pdf_url", "full_text_xml_url",
  "body_html_url", "president", "agencies", "abstract", "executive_order_notes", "disposition_notes",
];

async function main() {
  const report: SourceReport = {
    source: "Federal Register API",
    generated_at: new Date().toISOString(),
    window: { from: `${WINDOW.fromYear}-01-01`, to: new Date().toISOString().slice(0, 10) },
    base_urls: [BASE],
    ok: false,
    checks: [],
    rate_limits: {},
    gaps: [],
    findings: {},
  };

  // 1) Presidential documents mentioning glyphosate (any date), then keep executive orders.
  const search = await fetchJson<any>(
    `${BASE}/documents.json?${qs({ "conditions[term]": "glyphosate", "conditions[type][]": "PRESDOCU", per_page: 100, "fields[]": FIELDS })}`,
    OPTS,
  );
  const presDocs = search.data.results ?? [];
  const eos = presDocs.filter((d: any) => d.subtype === "Executive Order");
  report.findings.presidential_documents_mentioning_glyphosate = presDocs.map((d: any) => ({
    title: d.title, subtype: d.subtype, document_number: d.document_number, signing_date: d.signing_date, publication_date: d.publication_date, html_url: d.html_url,
  }));
  report.findings.search_source_url = search.url;
  report.checks.push({ name: "glyphosate executive orders", ok: eos.length > 0, detail: `${presDocs.length} presidential documents mention glyphosate; ${eos.length} are executive orders` });

  // 2) Full metadata for each EO + reachability of its PDF + documents that cite it.
  const eoDetails: any[] = [];
  for (const eo of eos) {
    const detail = await fetchJson<any>(`${BASE}/documents/${eo.document_number}.json?${qs({ "fields[]": FIELDS })}`, OPTS);
    const d = detail.data;
    let pdf: any = null;
    try {
      pdf = await checkUrl(d.pdf_url);
    } catch (e) {
      pdf = { error: (e as Error).message };
    }
    // Later Federal Register documents that mention the EO number (agency actions implementing it, etc.)
    const citing = await fetchJson<any>(
      `${BASE}/documents.json?${qs({ "conditions[term]": `"Executive Order ${d.executive_order_number}"`, "conditions[publication_date][gte]": d.publication_date, per_page: 50, order: "oldest", "fields[]": ["title", "type", "document_number", "publication_date", "agencies", "html_url"] })}`,
      OPTS,
    );
    eoDetails.push({
      title: d.title,
      executive_order_number: d.executive_order_number,
      document_number: d.document_number,
      signing_date: d.signing_date,
      publication_date: d.publication_date,
      citation: d.citation,
      president: d.president?.name ?? null,
      html_url: d.html_url,
      pdf_url: d.pdf_url,
      pdf_check: pdf?.error ? { error: pdf.error, note: "PDF is hosted on govinfo.gov (GPO); not reachable from this environment. html_url and full_text_xml_url on federalregister.gov are the stored sources." } : { status: pdf?.status, contentType: pdf?.contentType },
      full_text_xml_url: d.full_text_xml_url,
      executive_order_notes: d.executive_order_notes,
      source_url: detail.url,
      retrieved_at: detail.retrieved_at,
      later_documents_citing_it: {
        count: citing.data.count ?? 0,
        items: (citing.data.results ?? [])
          .filter((c: any) => c.document_number !== d.document_number)
          .map((c: any) => ({ title: c.title, type: c.type, document_number: c.document_number, publication_date: c.publication_date, agencies: (c.agencies ?? []).map((a: any) => a.name), html_url: c.html_url })),
        source_url: citing.url,
      },
    });
    report.checks.push({ name: `EO ${d.executive_order_number} metadata`, ok: !!(d.signing_date && d.document_number), detail: `signed ${d.signing_date}, published ${d.publication_date}, FR doc ${d.document_number}, ${d.citation}; PDF ${pdf?.error ? "unreachable (govinfo.gov)" : "HTTP " + pdf?.status}` });
  }
  report.findings.executive_orders = eoDetails;

  // 3) Context only (not a decision type in v1): agency documents about glyphosate in the window.
  const agency = await fetchJson<any>(
    `${BASE}/documents.json?${qs({ "conditions[term]": "glyphosate", "conditions[publication_date][gte]": `${WINDOW.fromYear}-01-01`, "conditions[type][]": ["RULE", "PRORULE", "NOTICE"], per_page: 20, order: "newest", "fields[]": ["title", "type", "document_number", "publication_date", "agencies", "html_url"] })}`,
    OPTS,
  );
  report.findings.agency_documents_mentioning_glyphosate = {
    count: agency.data.count,
    newest: (agency.data.results ?? []).slice(0, 10).map((c: any) => ({ title: c.title, type: c.type, publication_date: c.publication_date, agencies: (c.agencies ?? []).map((a: any) => a.name), html_url: c.html_url })),
    source_url: agency.url,
  };

  report.rate_limits = {
    observed_headers: "No API key required; no rate-limit headers observed.",
    documented: "Federal Register asks clients to be reasonable; this script waits 300ms between requests.",
  };
  report.gaps.push(
    "The Federal Register gives signing and publication dates but no time of day. Timeline precision is one day.",
    "Full-text search matches the word 'glyphosate' anywhere in a document. A future EO that affects glyphosate without naming it would be missed; re-run with broader terms (pesticide, FIFRA, phosphorus) if needed.",
    "Agency rules and notices about glyphosate (mostly EPA pesticide actions) are reachable but are not a v1 decision type. Adding them would be a new feature; ask first.",
  );
  report.ok = report.checks.every((c) => c.ok);
  writeReport("federal-register", report);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
