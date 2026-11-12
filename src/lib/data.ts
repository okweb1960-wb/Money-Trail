// Read layer for the app. Every function returns plain, serializable objects, and every
// fact carries its sourceUrl + retrievedAt. Data only changes when `npm run data` reloads
// the database, so results are cached for the life of the build/server.
import "server-only";
import { cacheLife } from "next/cache";
import { prisma } from "./db";
import { quarterOf, quarterRange } from "./quarters";
import { RULE_TEXT, RULES } from "./flags";
import { isCaseRelevant } from "./relevance";

export const CASE_SLUG = "glyphosate";
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const day = (d: Date) => d.toISOString().slice(0, 10);

export interface DecisionRow {
  id: string; kind: string; tier: "decision" | "event"; title: string; identifier: string; date: string; dateKind: string;
  quarter: string; summary: string | null; quoteSource: string | null; decidedBy: string; sourceUrl: string; retrievedAt: string;
}

export async function getDecisions(): Promise<DecisionRow[]> {
  "use cache";
  cacheLife("max");
  const rows = await prisma.decision.findMany({ where: { caseSlug: CASE_SLUG }, orderBy: { date: "asc" } });
  return rows.map((r) => ({
    id: r.id, kind: r.kind, tier: r.tier, title: r.title, identifier: r.identifier, date: day(r.date), dateKind: r.dateKind,
    quarter: quarterOf(r.date), summary: r.summary, quoteSource: r.quoteSource, decidedBy: r.decidedBy, sourceUrl: r.sourceUrl, retrievedAt: r.retrievedAt.toISOString(),
  }));
}

export interface TimelineRow {
  quarter: string;
  inHouse: number | null;
  outside: number | null;
  pac: number | null;
  caseEntries: number;
  caseEntriesPending: number;
  links: { inHouse: string[]; outside: string[]; pac: string[] };
}

export async function getTimeline(): Promise<{ rows: TimelineRow[]; firstQuarter: string; lastQuarter: string }> {
  "use cache";
  cacheLife("max");
  const [lobbying, pac, acts] = await Promise.all([
    prisma.filing.findMany({ where: { kind: "lobbying" }, select: { quarter: true, amount: true, amountKind: true, sourceUrl: true } }),
    prisma.filing.findMany({ where: { amountKind: "fec_disbursement" }, select: { quarter: true, amount: true, sourceUrl: true } }),
    prisma.activity.findMany({ select: { quarter: true, relevance: true, review: true } }),
  ]);
  const qs = lobbying.map((f) => f.quarter!).filter(Boolean).sort();
  const firstQuarter = qs[0] ?? "2018-Q1";
  const lastQuarter = qs[qs.length - 1] ?? quarterOf(new Date());
  const rows = quarterRange(firstQuarter, lastQuarter).map((q) => {
    const ih = lobbying.filter((f) => f.quarter === q && f.amountKind === "lda_expenses" && f.amount != null);
    const os = lobbying.filter((f) => f.quarter === q && f.amountKind === "lda_income" && f.amount != null);
    const pc = pac.filter((f) => f.quarter === q);
    const ce = acts.filter((a) => a.quarter === q && isCaseRelevant(a.relevance) && a.review !== "rejected");
    return {
      quarter: q,
      inHouse: ih.length ? ih.reduce((s, f) => s + f.amount!, 0) : null,
      outside: os.length ? os.reduce((s, f) => s + f.amount!, 0) : null,
      pac: pc.length ? Math.round(pc.reduce((s, f) => s + (f.amount ?? 0), 0) * 100) / 100 : null,
      caseEntries: ce.length,
      caseEntriesPending: ce.filter((a) => a.review === "proposed").length,
      links: { inHouse: ih.map((f) => f.sourceUrl), outside: os.map((f) => f.sourceUrl), pac: pc.slice(0, 50).map((f) => f.sourceUrl) },
    };
  });
  return { rows, firstQuarter, lastQuarter };
}

export interface FlagRow {
  id: string; rule: string; ruleTitle: string; ruleHow: string; decisionIds: string[]; window: string; wording: string;
  observed: Record<string, unknown>; baseline: Record<string, unknown>; evidence: Array<{ label: string; url: string }>; pendingReview: boolean;
}

export async function getFlags(): Promise<FlagRow[]> {
  "use cache";
  cacheLife("max");
  const rows = await prisma.patternFlag.findMany({ where: { caseSlug: CASE_SLUG } });
  const order = Object.keys(RULE_TEXT);
  return rows
    .map((r) => ({
      id: r.id, rule: r.rule, ruleTitle: RULE_TEXT[r.rule]?.title ?? r.rule, ruleHow: RULE_TEXT[r.rule]?.how ?? "",
      decisionIds: (r.decisionId ?? "").split(",").filter(Boolean), window: r.window, wording: r.wording,
      observed: JSON.parse(r.observed), baseline: JSON.parse(r.baseline), evidence: JSON.parse(r.evidence), pendingReview: r.pendingReview,
    }))
    .sort((a, b) => order.indexOf(a.rule) - order.indexOf(b.rule) || a.window.localeCompare(b.window));
}

export interface FilingRow { id: string; quarter: string; registrant: string; client: string; inHouse: boolean; amount: number | null; sourceUrl: string; retrievedAt: string }

export async function getLobbyingFilings(): Promise<FilingRow[]> {
  "use cache";
  cacheLife("max");
  const rows = await prisma.filing.findMany({ where: { kind: "lobbying" }, orderBy: [{ quarter: "desc" }, { amount: "desc" }] });
  return rows.map((f) => ({ id: f.id, quarter: f.quarter!, registrant: f.registrant ?? "", client: f.client ?? "", inHouse: f.amountKind === "lda_expenses", amount: f.amount, sourceUrl: f.sourceUrl, retrievedAt: f.retrievedAt.toISOString() }));
}

export interface CaseActivityRow { id: string; quarter: string; registrant: string; relevance: string; pending: boolean; description: string; govEntities: string[]; sourceUrl: string }

export async function getCaseActivities(): Promise<CaseActivityRow[]> {
  "use cache";
  cacheLife("max");
  const rows = await prisma.activity.findMany({ where: { relevance: { in: ["glyphosate_direct", "pesticide_policy"] }, review: { not: "rejected" } }, include: { filing: { select: { registrant: true } } }, orderBy: { quarter: "desc" } });
  return rows.map((a) => ({ id: a.id, quarter: a.quarter, registrant: a.filing.registrant ?? "", relevance: a.relevance, pending: a.review === "proposed", description: a.description, govEntities: JSON.parse(a.govEntities), sourceUrl: a.sourceUrl }));
}

export interface GraphNode { id: string; kind: string; label: string; subtitle: string | null; pending: boolean; sources: Array<{ label: string; url: string; retrievedAt: string }> }
export interface GraphEdge { id: string; type: string; source: string; target: string; amount: number | null; date: string | null; note: string | null; sourceUrl: string; retrievedAt: string }

export async function getNetwork(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  "use cache";
  cacheLife("max");
  const [entities, edges, decisions, cps] = await Promise.all([
    prisma.entity.findMany(),
    prisma.edge.findMany(),
    prisma.decision.findMany({ where: { caseSlug: CASE_SLUG, tier: "decision" }, orderBy: { date: "asc" } }),
    prisma.coveredPosition.findMany(),
  ]);
  const nodes: GraphNode[] = entities.map((e) => ({
    id: e.id, kind: e.kind, label: e.name, subtitle: e.subtitle, pending: e.review === "proposed",
    sources: [
      { label: "Primary source", url: e.sourceUrl, retrievedAt: e.retrievedAt.toISOString() },
      ...cps.filter((p) => p.lobbyistId === e.id).map((p) => ({ label: `Covered position: "${p.text}" (${p.firstQuarter}–${p.lastQuarter})`, url: p.sourceUrl, retrievedAt: p.retrievedAt.toISOString() })),
    ],
  }));
  for (const d of decisions) nodes.push({ id: d.id, kind: "decision", label: `${d.title} (${day(d.date)})`, subtitle: d.decidedBy, pending: false, sources: [{ label: d.identifier, url: d.sourceUrl, retrievedAt: d.retrievedAt.toISOString() }] });
  const decisionIds = new Set(decisions.map((d) => d.id));
  const out: GraphEdge[] = [];
  // Aggregate PAC -> official contributions into one edge per pair (each source is still listed on the node).
  for (const e of edges) {
    const target = e.toId ?? e.decisionId;
    if (!target) continue;
    if (!e.toId && !decisionIds.has(target)) continue; // edges to event-tier items are not drawn
    out.push({ id: e.id, type: e.type, source: e.fromId, target, amount: e.amount, date: iso(e.date), note: e.note, sourceUrl: e.sourceUrl, retrievedAt: e.retrievedAt.toISOString() });
  }
  return { nodes, edges: out };
}

export interface RevolvingRow { lobbyistId: string; name: string; registrants: string; pending: boolean; positions: Array<{ text: string; firstQuarter: string; lastQuarter: string; overlap: string | null; overlapPending: boolean; sourceUrl: string; retrievedAt: string }> }

export async function getRevolvingDoor(): Promise<RevolvingRow[]> {
  "use cache";
  cacheLife("max");
  const [lobbyists, cps] = await Promise.all([prisma.entity.findMany({ where: { kind: "lobbyist" }, orderBy: { name: "asc" } }), prisma.coveredPosition.findMany()]);
  return lobbyists.map((l) => ({
    lobbyistId: l.id, name: l.name, registrants: l.subtitle ?? "", pending: l.review === "proposed",
    positions: cps.filter((p) => p.lobbyistId === l.id).map((p) => ({ text: p.text, firstQuarter: p.firstQuarter, lastQuarter: p.lastQuarter, overlap: p.overlap, overlapPending: p.overlapReview === "proposed", sourceUrl: p.sourceUrl, retrievedAt: p.retrievedAt.toISOString() })),
  }));
}

export interface ClaimRow { id: string; speaker: string; venue: string; statement: string; timestamp: string | null; status: string; recordShows: Array<{ text: string; refs: string[] }>; recordDoesNotShow: Array<{ text: string; refs: string[] }>; sourceUrl: string; retrievedAt: string }

export async function getClaims(): Promise<ClaimRow[]> {
  "use cache";
  cacheLife("max");
  const rows = await prisma.claim.findMany({ where: { caseSlug: CASE_SLUG } });
  return rows.map((c) => ({ id: c.id, speaker: c.speaker, venue: c.venue, statement: c.statement, timestamp: c.timestamp, status: c.status, recordShows: JSON.parse(c.recordShows ?? "[]"), recordDoesNotShow: JSON.parse(c.recordDoesNotShow ?? "[]"), sourceUrl: c.sourceUrl, retrievedAt: c.retrievedAt.toISOString() }));
}

export interface DataRunRow { id: string; source: string; ranAt: string; notes: string | null }

export async function getDataRuns(): Promise<DataRunRow[]> {
  "use cache";
  cacheLife("max");
  const rows = await prisma.dataRun.findMany({ orderBy: { id: "asc" } });
  return rows.map((r) => ({ id: r.id, source: r.source, ranAt: r.ranAt.toISOString(), notes: r.notes }));
}

export async function getReviewStatus(): Promise<{ pendingActivities: number; pendingAliases: number; pendingFlags: number }> {
  "use cache";
  cacheLife("max");
  const [pendingActivities, pendingAliases, pendingFlags] = await Promise.all([
    prisma.activity.count({ where: { review: "proposed" } }),
    prisma.alias.count({ where: { review: "proposed" } }),
    prisma.patternFlag.count({ where: { pendingReview: true } }),
  ]);
  return { pendingActivities, pendingAliases, pendingFlags };
}

export { RULES, RULE_TEXT };
