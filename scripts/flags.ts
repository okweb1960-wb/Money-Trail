// Computes pattern flags from the loaded database and stores them in PatternFlag.
// Run: npm run flags   (after npm run db:load)
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { loadCase } from "./lib/case";
import { runAllRules, RULES, type ActivityIn, type ContributionIn, type DecisionIn, type FirmIn, type LobbyistIn, type RecipientTotalIn, type SpendIn } from "../src/lib/flags";
import { quarterRange, quarterOf } from "../src/lib/quarters";

const prisma = new PrismaClient({ adapter: new PrismaLibSql({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }) });
const iso = (x: Date) => x.toISOString().slice(0, 10);

async function main() {
  const c = loadCase();
  const decRows = await prisma.decision.findMany({ where: { caseSlug: c.slug }, orderBy: { date: "asc" } });
  const decisions: DecisionIn[] = decRows.map((r) => {
    const cfg = c.decisions.find((x) => `${c.slug}:${x.key}` === r.id);
    return { id: r.id, title: r.title, date: iso(r.date), tier: r.tier, ldaEntities: JSON.parse(r.ldaEntities), bodyKeywords: cfg?.bodyKeywords ?? [] };
  });

  const lobbying = await prisma.filing.findMany({ where: { kind: "lobbying" } });
  const allQuarters = quarterRange(`${c.window_from_year}-Q1`, quarterOf(new Date()));
  const spend: SpendIn[] = allQuarters.map((q) => {
    const fs = lobbying.filter((f) => f.quarter === q);
    const ih = fs.filter((f) => f.amountKind === "lda_expenses" && f.amount != null);
    const os = fs.filter((f) => f.amountKind === "lda_income" && f.amount != null);
    return { quarter: q, inHouse: ih.length ? ih.reduce((s, f) => s + f.amount!, 0) : null, outside: os.length ? os.reduce((s, f) => s + f.amount!, 0) : null, filings: { inHouse: ih.map((f) => f.sourceUrl), outside: os.map((f) => f.sourceUrl) } };
  });
  // Drop trailing quarters with no filings yet (reports are filed ~20 days after quarter end).
  while (spend.length && spend[spend.length - 1].inHouse == null && spend[spend.length - 1].outside == null) spend.pop();

  const acts = await prisma.activity.findMany({ include: { filing: true } });
  const activities: ActivityIn[] = acts.filter((a) => a.review !== "rejected").map((a) => ({
    id: a.id, quarter: a.quarter, relevance: a.relevance, pending: a.review === "proposed", govEntities: JSON.parse(a.govEntities),
    registrant: a.filing.registrant ?? "", excerpt: a.description, sourceUrl: a.sourceUrl, lobbyistIds: JSON.parse(a.lobbyistIds),
  }));

  const firmRows = await prisma.entity.findMany({ where: { kind: "lobbying_firm" } });
  const firms: FirmIn[] = firmRows.map((f) => ({ id: f.id, name: f.name, firstQuarter: JSON.parse(f.externalIds).firstQuarter, sourceUrl: f.sourceUrl }));

  const lobRows = await prisma.entity.findMany({ where: { kind: "lobbyist" } });
  const cps = await prisma.coveredPosition.findMany();
  const lobbyists: LobbyistIn[] = lobRows.map((l) => ({ id: l.id, name: l.name, coveredPositions: cps.filter((p) => p.lobbyistId === l.id).map((p) => ({ text: p.text, sourceUrl: p.sourceUrl })) }));

  const contribEdges = await prisma.edge.findMany({ where: { type: "contributed_to", decisionId: { not: null } }, include: { to: true, from: true } });
  const contributions: ContributionIn[] = contribEdges.filter((e) => e.date && e.amount != null && e.to).map((e) => ({
    officialId: e.toId!, officialName: e.to!.name, decisionId: e.decisionId!, date: iso(e.date!), amount: e.amount!, label: e.note ?? e.from.name, sourceUrl: e.sourceUrl,
  }));

  // Baseline for rule 5: totals per federal recipient over the lookback window before each relevant decision.
  const fecRows = await prisma.filing.findMany({ where: { amountKind: "fec_disbursement" } });
  const flagsOut = [];
  const subjectId = c.company.id;
  const base = runAllRules({ subjectId, decisions, spend, activities, firms, lobbyists, contributions: [], recipientTotals: [], allQuarters: spend.map((s) => s.quarter) });
  flagsOut.push(...base.filter((f) => f.rule !== "contribution_to_decision_participant"));
  const contribDecisionIds = [...new Set(contributions.map((x) => x.decisionId))];
  for (const did of contribDecisionIds) {
    const dec = decisions.find((x) => x.id === did)!;
    const end = new Date(dec.date);
    const start = new Date(end);
    start.setUTCMonth(start.getUTCMonth() - RULES.CONTRIB_LOOKBACK_MONTHS);
    const totals = new Map<string, number>();
    for (const f of fecRows) {
      if (!f.date || f.date < start || f.date > end) continue;
      const key = JSON.parse(f.payload).candidate_id ?? JSON.parse(f.payload).recipient_committee_id ?? f.recipient;
      totals.set(key, (totals.get(key) ?? 0) + (f.amount ?? 0));
    }
    const recipientTotals: RecipientTotalIn[] = [...totals].map(([recipient, total]) => ({ recipient, total, dateFrom: iso(start), dateTo: dec.date }));
    const { contributionToDecisionParticipant } = await import("../src/lib/flags");
    flagsOut.push(...contributionToDecisionParticipant(subjectId, decisions, contributions.filter((x) => x.decisionId === did), recipientTotals));
  }

  await prisma.patternFlag.deleteMany({ where: { caseSlug: c.slug } });
  const now = new Date();
  for (const f of flagsOut) {
    await prisma.patternFlag.create({
      data: { id: f.id, caseSlug: c.slug, rule: f.rule, subjectId: f.subjectId, decisionId: f.decisionIds.join(","), window: f.window, observed: JSON.stringify(f.observed), baseline: JSON.stringify(f.baseline), evidence: JSON.stringify(f.evidence), wording: f.wording, pendingReview: f.pendingReview, computedAt: now },
    });
  }
  const byRule = flagsOut.reduce<Record<string, number>>((m, f) => ((m[f.rule] = (m[f.rule] ?? 0) + 1), m), {});
  console.log(`Flags: ${flagsOut.length}`, byRule);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
