// Loads data/raw/* + data/review/* + data/case/* into SQLite (prisma/dev.db).
// Rules enforced here:
//  - every row gets sourceUrl + retrievedAt from the raw snapshot it came from
//  - only corporate client names approved/proposed in data/review/lda-client-aliases.csv are loaded
//  - people: only lobbyists on case-related activity near a decision, and officials tied to a decision
//  - FEC: federal recipients only (state/local recipients and transfers to affiliated PACs are excluded)
// Run: npm run db:load
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { readRaw } from "./lib/raw";
import { loadCase } from "./lib/case";
import { loadAliasDecisions, loadActivityDecisions, loadOverlapDecisions, activityKey } from "./lib/review";
import { classifyActivity, isCaseRelevant } from "../src/lib/relevance";
import { ldaQuarter, quarterOf, quarterIndex, quarterStart, quarterEnd } from "../src/lib/quarters";

const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }) });
const c = loadCase();
const DOCKET_HTML = `https://www.supremecourt.gov/search.aspx?filename=/docket/docketfiles/html/public/${c.scotus.docket}.html`;
const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const d = (s: string) => new Date(s);
const warn: string[] = [];
// Party names as the docket states them ("Monsanto Company, Petitioner" -> "Monsanto Company").
const docketTitles = readRaw<any>("scotus/docket.json").data;
const PETITIONER = String(docketTitles.PetitionerTitle ?? "petitioner").replace(/,\s*Petitioners?$/i, "").trim();
const RESPONDENT = String(docketTitles.RespondentTitle ?? "respondent").replace(/,\s*Respondents?$/i, "").trim();
const SIDE_LABEL: Record<string, string> = { petitioner: `supporting ${PETITIONER} (petitioner)`, respondent: `supporting ${RESPONDENT} (respondent)`, neither: "supporting neither party", not_stated: "no side stated on the cover" };

function docketDate(s: string): Date {
  const t = new Date(`${s} 12:00 UTC`);
  if (isNaN(+t)) throw new Error(`Unparseable docket date ${s}`);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

async function wipe() {
  await prisma.patternFlag.deleteMany();
  await prisma.amicusBrief.deleteMany();
  await prisma.caseInfo.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.edge.deleteMany();
  await prisma.alias.deleteMany();
  await prisma.coveredPosition.deleteMany();
  await prisma.filing.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.entity.deleteMany();
  await prisma.dataRun.deleteMany();
}

async function loadDecisions() {
  const docket = readRaw<any>("scotus/docket.json");
  const docs = readRaw<any[]>("scotus/documents.json").data;
  const fr = readRaw<any[]>("federal-register/executive-orders.json");
  const entries: any[] = docket.data.ProceedingsandOrder ?? [];
  const out = new Map<string, { id: string; date: Date }>();

  for (const cfg of c.decisions) {
    const id = `${c.slug}:${cfg.key}`;
    if (cfg.source === "federal_register") {
      const eo = fr.data[0];
      if (!eo) { warn.push(`No executive order found in Federal Register data for ${cfg.key}`); continue; }
      await prisma.decision.create({
        data: {
          id, caseSlug: c.slug, kind: cfg.kind as any, tier: cfg.tier, title: `Executive Order ${eo.executive_order_number}`,
          identifier: `EO ${eo.executive_order_number} · FR doc ${eo.document_number} · ${eo.citation}`,
          date: d(eo.signing_date), dateKind: "signed",
          summary: `"${eo.title}" Signed ${eo.signing_date}; published in the Federal Register ${eo.publication_date} (${eo.citation}).`,
          quoteSource: eo.html_url, decidedBy: cfg.decidedBy, ldaEntities: JSON.stringify(cfg.ldaEntities ?? []),
          sourceUrl: eo.html_url, retrievedAt: d(eo._retrieved_at),
        },
      });
      out.set(cfg.key, { id, date: d(eo.signing_date) });
      continue;
    }
    const hits = entries.filter((e) => new RegExp(cfg.match!, "i").test(strip(e.Text)));
    const e = hits[cfg.nth ?? 0];
    if (!e) { warn.push(`Docket entry not found for ${cfg.key} (pattern ${cfg.match})`); continue; }
    const doc = docs.find((x) => x.key === cfg.key);
    const main = e.Links?.find((l: any) => l.Description === "Main Document")?.DocumentUrl ?? e.Text.match(/href\s*=\s*'([^']+)'/)?.[1];
    const date = docketDate(e.Date);
    await prisma.decision.create({
      data: {
        id, caseSlug: c.slug, kind: cfg.kind as any, tier: cfg.tier, title: cfg.title ?? strip(e.Text).slice(0, 80),
        identifier: `No. ${c.scotus.docket} · docket entry ${e.Date}`,
        date, dateKind: cfg.dateKind,
        summary: doc?.excerpt ? `"${doc.excerpt}"` : `Docket: "${strip(e.Text).slice(0, 400)}"`,
        quoteSource: doc?.excerpt ? doc.url : DOCKET_HTML, decidedBy: cfg.decidedBy, ldaEntities: JSON.stringify(cfg.ldaEntities ?? []),
        sourceUrl: main ?? DOCKET_HTML, retrievedAt: d(docket.retrieved_at),
      },
    });
    out.set(cfg.key, { id, date });
  }
  await prisma.dataRun.create({ data: { id: "scotus", source: "Supreme Court docket", ranAt: d(docket.retrieved_at) } });
  await prisma.dataRun.create({ data: { id: "federal-register", source: "Federal Register API", ranAt: d(fr.retrieved_at), notes: fr.data[0]?._raw_text ? "full text retrieved" : "full text not retrieved (blocked); title and metadata only" } });
  return { decisions: out, docketEntries: entries, docketRetrieved: docket.retrieved_at };
}

async function main() {
  await wipe();
  const { decisions, docketEntries, docketRetrieved } = await loadDecisions();
  await prisma.caseInfo.create({ data: { slug: c.slug, docket: c.scotus.docket, petitioner: PETITIONER, respondent: RESPONDENT, sourceUrl: DOCKET_HTML, retrievedAt: d(docketRetrieved) } });
  const decisionQuarters = [...c.decisions.filter((x) => x.tier === "decision")].map((x) => decisions.get(x.key)).filter(Boolean).map((x) => quarterOf(x!.date));
  const nearDecision = (q: string) => decisionQuarters.some((dq) => Math.abs(quarterIndex(q) - quarterIndex(dq)) <= 2);

  // ---------- LDA ----------
  const lda = readRaw<any[]>("lda/filings.json");
  const aliasDec = loadAliasDecisions();
  const actDec = loadActivityDecisions();
  const overlapDec = loadOverlapDecisions();
  if (!aliasDec.size) throw new Error("data/review/lda-client-aliases.csv missing — run `npm run review:generate` first.");

  const companyId = c.company.id;
  const firstInHouse = lda.data.find((f) => f.expenses != null);
  await prisma.entity.create({
    data: { id: companyId, kind: "company", name: c.company.name, review: [...aliasDec.values()].some((a) => a.include && a.review === "proposed") ? "proposed" : "approved", sourceUrl: firstInHouse?.filing_document_url ?? "https://lda.gov/", retrievedAt: d(lda.retrieved_at) },
  });
  for (const [alias, a] of aliasDec) if (a.include) await prisma.alias.create({ data: { entityId: companyId, alias, source: "lda_client", review: a.review } });

  const included = lda.data.filter((f) => aliasDec.get(f.client.name)?.include && ldaQuarter(f.filing_year, f.filing_period));
  const latest = new Map<string, any>();
  for (const f of included) {
    const k = `${f.registrant.id}|${f.client.id}|${f.filing_year}|${f.filing_period}`;
    const p = latest.get(k);
    if (!p || p.dt_posted < f.dt_posted) latest.set(k, f);
  }
  const firms = new Map<string, { name: string; first: string; last: string; total: number; latestUrl: string; retrieved: string; sub: boolean }>();
  const lobbyistAppearances = new Map<string, { name: string; positions: Map<string, { first: string; last: string; url: string; retrieved: string }>; registrants: Set<string>; inHouse: boolean; firmIds: Set<string> }>();
  const tiedLobbyists = new Set<string>();
  const tiedPending = new Set<string>();
  let nFilings = 0, nActs = 0;

  for (const f of latest.values()) {
    const q = ldaQuarter(f.filing_year, f.filing_period)!;
    const inHouse = f.expenses != null && f.income == null;
    const fid = `lda:${f.filing_uuid}`;
    await prisma.filing.create({
      data: {
        id: fid, kind: "lobbying", externalId: f.filing_uuid, quarter: q, periodStart: quarterStart(q), periodEnd: quarterEnd(q), date: d(f.dt_posted),
        amount: inHouse ? Number(f.expenses) : f.income != null ? Number(f.income) : null, amountKind: inHouse ? "lda_expenses" : "lda_income",
        registrant: f.registrant.name, client: f.client.name, description: f.filing_type_display,
        payload: JSON.stringify({ filing_type: f.filing_type, registrant_id: f.registrant.id, client_id: f.client.id, in_house: inHouse }),
        sourceUrl: f.filing_document_url, retrievedAt: d(f._retrieved_at ?? lda.retrieved_at),
      },
    });
    nFilings++;
    const firmId = inHouse ? companyId : `firm:${f.registrant.id}`;
    if (!inHouse) {
      const e = firms.get(firmId) ?? { name: f.registrant.name, first: q, last: q, total: 0, latestUrl: f.filing_document_url, retrieved: f._retrieved_at, sub: /on behalf of|obo/i.test(f.client.name) };
      if (q < e.first) e.first = q;
      if (q >= e.last) { e.last = q; e.latestUrl = f.filing_document_url; }
      e.total += f.income != null ? Number(f.income) : 0;
      firms.set(firmId, e);
    }
    for (const [i, a] of (f.lobbying_activities ?? []).entries()) {
      const desc = (a.description ?? "").trim();
      const decision = actDec.get(activityKey(f.registrant.name, desc));
      const cls = classifyActivity(desc);
      const relevance = decision?.relevance ?? (cls.relevance === "general" ? "general" : cls.relevance);
      const review = decision?.review ?? (cls.relevance === "general" ? "screened_out" : "proposed");
      const lobbyistIds = (a.lobbyists ?? []).map((l: any) => `lda-lobbyist:${l.lobbyist.id}`);
      await prisma.activity.create({
        data: {
          id: `${fid}:${i}`, filingId: fid, quarter: q, issueCode: a.general_issue_code, issueName: a.general_issue_code_display, description: desc,
          govEntities: JSON.stringify((a.government_entities ?? []).map((g: any) => g.name)), lobbyistIds: JSON.stringify(lobbyistIds),
          relevance, review, matched: JSON.stringify(cls.matched), sourceUrl: f.filing_document_url, retrievedAt: d(f._retrieved_at ?? lda.retrieved_at),
        },
      });
      nActs++;
      for (const l of a.lobbyists ?? []) {
        const lid = `lda-lobbyist:${l.lobbyist.id}`;
        const e = lobbyistAppearances.get(lid) ?? { name: `${l.lobbyist.first_name} ${l.lobbyist.last_name}`.replace(/\s+/g, " ").trim(), positions: new Map(), registrants: new Set(), inHouse, firmIds: new Set() };
        e.registrants.add(f.registrant.name);
        e.firmIds.add(firmId);
        const cp = (l.covered_position ?? "").trim();
        if (cp) {
          const p = e.positions.get(cp) ?? { first: q, last: q, url: f.filing_document_url, retrieved: f._retrieved_at ?? lda.retrieved_at };
          if (q < p.first) p.first = q;
          if (q > p.last) p.last = q;
          e.positions.set(cp, p);
        }
        lobbyistAppearances.set(lid, e);
        if (isCaseRelevant(relevance) && review !== "rejected" && nearDecision(q)) {
          tiedLobbyists.add(lid);
          if (review === "proposed") tiedPending.add(lid);
        }
      }
    }
  }

  for (const [id, f] of firms) {
    await prisma.entity.create({
      data: { id, kind: "lobbying_firm", name: f.name, subtitle: `Reported lobbying for the company ${f.first} – ${f.last}${f.sub ? " (incl. as sub-contractor)" : ""}`, externalIds: JSON.stringify({ firstQuarter: f.first, lastQuarter: f.last }), review: "approved", sourceUrl: f.latestUrl, retrievedAt: d(f.retrieved ?? lda.retrieved_at) },
    });
    await prisma.edge.create({
      data: { id: `edge:lobbied_for:${id}`, type: "lobbied_for", fromId: id, toId: companyId, amount: f.total, note: `${f.first} – ${f.last}; total reported income from this client`, sourceUrl: f.latestUrl, retrievedAt: d(f.retrieved ?? lda.retrieved_at) },
    });
  }

  for (const lid of tiedLobbyists) {
    const e = lobbyistAppearances.get(lid)!;
    const anyPos = [...e.positions.values()][0];
    await prisma.entity.create({
      data: { id: lid, kind: "lobbyist", name: e.name, subtitle: [...e.registrants].join("; "), review: tiedPending.has(lid) ? "proposed" : "approved", externalIds: JSON.stringify({ lda_lobbyist_id: lid.split(":")[1] }), sourceUrl: anyPos?.url ?? [...firms.values()][0]?.latestUrl ?? "https://lda.gov/", retrievedAt: d(lda.retrieved_at) },
    });
    for (const fid of e.firmIds) {
      if (fid !== companyId && !firms.has(fid)) continue;
      await prisma.edge.create({ data: { id: `edge:employed_by:${lid}:${fid}`, type: "employed_by", fromId: lid, toId: fid, note: fid === companyId ? "in-house lobbyist" : "listed by this registrant", sourceUrl: anyPos?.url ?? firms.get(fid)?.latestUrl ?? "https://lda.gov/", retrievedAt: d(lda.retrieved_at) } });
    }
    for (const [text, p] of e.positions) {
      const ov = overlapDec.get(`${lid.split(":")[1]}|${text}`);
      await prisma.coveredPosition.create({ data: { lobbyistId: lid, text, firstQuarter: p.first, lastQuarter: p.last, overlap: ov?.note ?? null, overlapReview: ov?.review ?? "proposed", sourceUrl: p.url, retrievedAt: d(p.retrieved) } });
    }
  }
  await prisma.dataRun.create({ data: { id: "lda", source: "Senate LDA (lda.gov)", ranAt: d(lda.retrieved_at), notes: `${nFilings} LD-2 filings, ${nActs} activities, ${firms.size} outside firms, ${tiedLobbyists.size} lobbyists tied to a decision window` } });

  // Sides stated on amicus brief covers (data/raw/scotus/amicus-briefs.json, from npm run fetch:amicus)
  let amicusSides: Array<{ filer: string; url: string; side: string; coverPhrase: string | null; docketDate: string; retrieved_at: string }> = [];
  try {
    amicusSides = readRaw<any[]>("scotus/amicus-briefs.json").data;
  } catch {
    warn.push("data/raw/scotus/amicus-briefs.json missing — run npm run fetch:amicus; amicus sides not shown");
  }
  const sideByUrl = new Map(amicusSides.map((x) => [x.url, x]));

  // ---------- Officials ----------
  const officialDecision = new Map<string, string>();
  for (const o of c.officials) {
    let src: string | undefined;
    let filedDate: Date | undefined;
    if (o.docketMatch) {
      const e = docketEntries.find((x) => new RegExp(o.docketMatch!, "i").test(strip(x.Text)));
      if (!e) { warn.push(`Official ${o.name}: docket text not found — skipped`); continue; }
      src = e.Links?.find((l: any) => l.Description === "Main Document")?.DocumentUrl ?? DOCKET_HTML;
      filedDate = docketDate(e.Date);
    }
    const linkDecisions = o.links.map((l) => ({ ...l, dec: decisions.get(l.decision) })).filter((l) => l.dec);
    if (!linkDecisions.length) { warn.push(`Official ${o.name}: no linked decision loaded — skipped`); continue; }
    const firstDec = await prisma.decision.findUnique({ where: { id: linkDecisions[0].dec!.id } });
    await prisma.entity.create({ data: { id: o.id, kind: "official", name: o.name, subtitle: o.role, review: "approved", sourceUrl: src ?? firstDec!.sourceUrl, retrievedAt: d(docketRetrieved) } });
    for (const l of linkDecisions) {
      const dec = await prisma.decision.findUnique({ where: { id: l.dec!.id } });
      const sd = src ? sideByUrl.get(src) : undefined;
      await prisma.edge.create({ data: { id: `edge:${l.type}:${o.id}:${l.dec!.id}`, type: l.type, fromId: o.id, toId: null, decisionId: l.dec!.id, date: filedDate ?? dec!.date, note: o.role, side: sd?.side ?? null, sidePhrase: sd?.coverPhrase ?? null, sourceUrl: src ?? dec!.sourceUrl, retrievedAt: d(docketRetrieved) } });
      officialDecision.set(o.id, l.dec!.id);
    }
  }

  // ---------- Organizations that filed amicus briefs ----------
  let nOrgs = 0;
  if (c.amicus) {
    const officialPatterns = c.officials.filter((o) => o.docketMatch).map((o) => new RegExp(o.docketMatch!, "i"));
    const grant = decisions.get(c.amicus.petitionStageDecision);
    const orgs = new Map<string, Array<{ date: Date; url: string; key: string }>>();
    for (const e of docketEntries) {
      const text = strip(e.Text);
      const m = text.match(/^Brief amic(?:us|i) curiae of (.+?) filed\./i);
      if (!m) continue;
      if (officialPatterns.some((re) => re.test(text))) continue;
      const name = m[1].trim();
      if (c.amicus.exclude.some((x) => new RegExp(x.pattern, "i").test(name))) continue;
      const date = docketDate(e.Date);
      const key = grant && date < grant.date ? c.amicus.petitionStageDecision : c.amicus.meritsStageDecision;
      const url = e.Links?.find((l: any) => l.Description === "Main Document")?.DocumentUrl ?? DOCKET_HTML;
      orgs.set(name, [...(orgs.get(name) ?? []), { date, url, key }]);
    }
    for (const [name, briefs] of orgs) {
      const id = `org:${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
      const sides = [...new Set(briefs.map((b) => sideByUrl.get(b.url)?.side ?? "not_stated"))];
      const sideText = sides.map((s) => SIDE_LABEL[s] ?? s).join("; ");
      await prisma.entity.create({ data: { id, kind: "organization", name, subtitle: `Filed ${briefs.length} amicus brief${briefs.length > 1 ? "s" : ""} — ${sideText} (as stated on the brief cover).`, review: "approved", sourceUrl: briefs[0].url, retrievedAt: d(docketRetrieved) } });
      for (const [i, b] of briefs.entries()) {
        const dec = decisions.get(b.key);
        if (!dec) continue;
        const sd = sideByUrl.get(b.url);
        await prisma.edge.create({ data: { id: `edge:filed_in:${id}:${i}`, type: "filed_in", fromId: id, toId: null, decisionId: dec.id, date: b.date, note: `Amicus brief filed ${b.date.toISOString().slice(0, 10)}`, side: sd?.side ?? "not_stated", sidePhrase: sd?.coverPhrase ?? null, sourceUrl: b.url, retrievedAt: d(docketRetrieved) } });
      }
      nOrgs++;
    }
  }

  // ---------- Every amicus brief (for the "who filed, which side" table) ----------
  {
    const grantDate = decisions.get(c.amicus?.petitionStageDecision ?? "cert_granted")?.date;
    const officialRes = c.officials.filter((o) => o.docketMatch).map((o) => ({ id: o.id, re: new RegExp(o.docketMatch!, "i") }));
    const allEntities = await prisma.entity.findMany({ where: { kind: "organization" }, select: { id: true, name: true } });
    for (const [i, x] of amicusSides.entries()) {
      const filedOn = docketDate(x.docketDate);
      const off = officialRes.find((o) => o.re.test(`Brief amic${/amici/i.test(x.filer) ? "i" : "us"} curiae of ${x.filer} filed`) || o.re.test(`Brief amicus curiae of ${x.filer} filed`) || o.re.test(`Brief amici curiae of ${x.filer} filed`));
      const isUS = /^(the )?United States$/i.test(x.filer);
      const isIndividuals = (c.amicus?.exclude ?? []).some((e) => !/United States/.test(e.pattern) && new RegExp(e.pattern, "i").test(x.filer));
      const org = allEntities.find((e) => e.name === x.filer);
      const filerKind = isUS ? "united_states" : off ? (/state senator|legislator|senator/i.test(x.filer) ? "official" : "government") : isIndividuals ? "individuals" : "organization";
      await prisma.amicusBrief.create({ data: {
        id: `amicus:${i}`, caseSlug: c.slug,
        filer: isIndividuals ? "Individuals (not named on this site)" : x.filer,
        filerKind, entityId: isUS ? "official:us-sg" : off?.id ?? org?.id ?? null,
        stage: grantDate && filedOn < grantDate ? "petition" : "merits", filedOn, side: x.side, sidePhrase: x.coverPhrase,
        sourceUrl: x.url, retrievedAt: d(x.retrieved_at),
      } });
      // SG edges: attach the side of the matching U.S. brief
      if (isUS) {
        const e = await prisma.edge.findFirst({ where: { fromId: "official:us-sg", sourceUrl: x.url } });
        if (e) await prisma.edge.update({ where: { id: e.id }, data: { side: x.side, sidePhrase: x.coverPhrase } });
      }
    }
  }

  // ---------- FEC ----------
  const fec = readRaw<any[]>("fec/committees.json");
  const cands = readRaw<any[]>("fec/candidates.json").data;
  const officialFec = new Map<string, { candidateIds: Set<string>; committeeIds: Set<string>; url: string }>();
  for (const o of c.officials.filter((x) => x.fec)) {
    const res = cands.find((x) => x.official_id === o.id)?.results ?? [];
    const m = res.filter((r: any) => r.name.toUpperCase().includes(o.fec!.name) && r.name.toUpperCase().includes(o.fec!.first) && r.office === o.fec!.office);
    if (m.length !== 1) { warn.push(`FEC match for ${o.name}: ${m.length} candidates — contributions not linked`); continue; }
    officialFec.set(o.id, { candidateIds: new Set([m[0].candidate_id]), committeeIds: new Set((m[0].principal_committees ?? []).map((p: any) => p.committee_id)), url: `https://www.fec.gov/data/candidate/${m[0].candidate_id}/` });
    await prisma.entity.update({ where: { id: o.id }, data: { externalIds: JSON.stringify({ fec_candidate_id: m[0].candidate_id }) } }).catch(() => undefined);
  }
  const windowStart = new Date(Date.UTC(c.window_from_year, 0, 1));
  let nContrib = 0, nExcludedState = 0, nAffiliated = 0;
  for (const cm of fec.data) {
    const id = `committee:${cm.committee.committee_id}`;
    const names = [...new Set((cm.history as any[]).sort((a, b) => a.cycle - b.cycle).map((h) => h.name))];
    const terminated = cm.history[0]?.filing_frequency === "T";
    await prisma.entity.create({
      data: {
        id, kind: "committee", name: cm.committee.name, subtitle: `${terminated ? `Terminated (last filing ${cm.history[0].last_file_date}). ` : ""}Former names: ${names.filter((n) => n !== cm.committee.name).join("; ") || "none"}`,
        externalIds: JSON.stringify({ fec_committee_id: cm.committee.committee_id }), review: "approved",
        sourceUrl: `https://www.fec.gov/data/committee/${cm.committee.committee_id}/`, retrievedAt: d(fec.retrieved_at),
      },
    });
    await prisma.edge.create({ data: { id: `edge:affiliated:${id}`, type: "affiliated_with", fromId: id, toId: companyId, note: `FEC lists the connected organization as ${cm.committee.affiliated_committee_name ?? cm.history[0]?.affiliated_committee_name ?? "n/a"}`, sourceUrl: `https://www.fec.gov/data/committee/${cm.committee.committee_id}/`, retrievedAt: d(fec.retrieved_at) } });

    for (const x of cm.disbursements) {
      if (x.memo_code === "X") continue; // memo entries duplicate other lines
      if (!x.disbursement_date || d(x.disbursement_date) < windowStart) continue;
      if (/\b(BAYER|MONSANTO)\b/i.test(x.recipient_name ?? "")) { nAffiliated++; continue; }
      if (!x.recipient_committee_id && !x.candidate_id) { nExcludedState++; continue; }
      const fid = `fec:${x.sub_id}`;
      const url = x.pdf_url ?? `https://www.fec.gov/data/committee/${cm.committee.committee_id}/?tab=spending`;
      await prisma.filing.create({
        data: {
          id: fid, kind: "contribution", externalId: String(x.sub_id), quarter: quarterOf(x.disbursement_date), date: d(x.disbursement_date), amount: x.disbursement_amount, amountKind: "fec_disbursement",
          registrant: cm.committee.name, recipient: x.recipient_name,
          payload: JSON.stringify({ committee_id: cm.committee.committee_id, recipient_committee_id: x.recipient_committee_id, candidate_id: x.candidate_id, candidate_office: x.candidate_office }),
          sourceUrl: url, retrievedAt: d(x._retrieved_at ?? fec.retrieved_at),
        },
      });
      nContrib++;
      for (const [oid, m] of officialFec) {
        if (m.candidateIds.has(x.candidate_id) || m.committeeIds.has(x.recipient_committee_id)) {
          await prisma.edge.create({ data: { id: `edge:contrib:${fid}:${oid}`, type: "contributed_to", fromId: id, toId: oid, decisionId: officialDecision.get(oid), filingId: fid, amount: x.disbursement_amount, date: d(x.disbursement_date), note: `${cm.committee.name} → ${x.recipient_name}`, sourceUrl: url, retrievedAt: d(x._retrieved_at ?? fec.retrieved_at) } });
        }
      }
    }
  }
  await prisma.dataRun.create({ data: { id: "fec", source: "OpenFEC API", ranAt: d(fec.retrieved_at), notes: `${nContrib} federal PAC disbursements loaded; excluded ${nExcludedState} non-federal (state/local) and ${nAffiliated} transfers to affiliated committees` } });

  // LD-203 contributions by the company's own lobbyists/registrant to officials in the case config
  const ld203 = readRaw<any[]>("lda/contributions.json");
  let n203 = 0;
  for (const r of ld203.data) {
    if (!aliasDec.get(r.registrant?.name)?.include && !/\b(BAYER|MONSANTO)\b/i.test(r.registrant?.name ?? "")) continue;
    for (const [i, it] of (r.contribution_items ?? []).entries()) {
      for (const o of c.officials.filter((x) => x.fec && officialFec.has(x.id))) {
        const hay = `${it.honoree_name ?? ""} ${it.payee_name ?? ""}`.toUpperCase();
        if (!(hay.includes(o.fec!.name) && hay.includes(o.fec!.first))) continue;
        const fid = `ld203:${r.filing_uuid}:${i}`;
        await prisma.filing.create({ data: { id: fid, kind: "contribution", externalId: r.filing_uuid, quarter: it.date ? quarterOf(it.date) : null, date: it.date ? d(it.date) : null, amount: Number(it.amount), amountKind: "ld203_contribution", registrant: r.registrant?.name, recipient: it.payee_name, description: `LD-203: ${it.contribution_type_display ?? ""}; honoree ${it.honoree_name ?? ""}; filer ${r.lobbyist ? "lobbyist" : "registrant"}`, sourceUrl: r.filing_document_url, retrievedAt: d(r._retrieved_at ?? ld203.retrieved_at) } });
        await prisma.edge.create({ data: { id: `edge:ld203:${fid}:${o.id}`, type: "contributed_to", fromId: companyId, toId: o.id, decisionId: officialDecision.get(o.id), filingId: fid, amount: Number(it.amount), date: it.date ? d(it.date) : null, note: `Reported on LD-203 by ${r.registrant?.name}`, sourceUrl: r.filing_document_url, retrievedAt: d(r._retrieved_at ?? ld203.retrieved_at) } });
        n203++;
      }
    }
  }

  // ---------- Claims ----------
  const claimsPath = join(process.cwd(), "data", "claims", `${c.slug}.json`);
  let nClaims = 0;
  if (existsSync(claimsPath)) {
    const claims = JSON.parse(readFileSync(claimsPath, "utf8")).claims ?? [];
    for (const cl of claims) {
      if (!cl.sourceUrl || !cl.retrievedAt || !cl.statement) { warn.push(`Claim ${cl.id} skipped: missing source/statement`); continue; }
      await prisma.claim.create({ data: { id: cl.id, caseSlug: c.slug, speaker: cl.speaker, venue: cl.venue, statement: cl.statement, timestamp: cl.timestamp ?? null, status: cl.status ?? "unreviewed", transcriptUrl: cl.transcriptUrl ?? null, verificationNote: cl.verificationNote ?? null, recordShows: JSON.stringify(cl.recordShows ?? []), recordDoesNotShow: JSON.stringify(cl.recordDoesNotShow ?? []), sourceUrl: cl.sourceUrl, retrievedAt: d(cl.retrievedAt) } });
      nClaims++;
    }
  }

  console.log(`Loaded: ${decisions.size} decisions/events, ${nFilings} LD-2 filings, ${nActs} activities, ${firms.size} firms, ${tiedLobbyists.size} lobbyists, ${nContrib} FEC disbursements (excluded ${nExcludedState} state/local, ${nAffiliated} affiliated transfers), ${n203} LD-203 items to case officials, ${nOrgs} amicus organizations, ${nClaims} claims`);
  if (warn.length) console.log("Warnings:\n" + warn.map((w) => "  - " + w).join("\n"));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
