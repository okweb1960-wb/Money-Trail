// Pattern-flag rules. PURE functions: same inputs -> same outputs.
// No rule reads a party, administration, or name. Thresholds are global constants,
// shown on /methodology. Every flag carries its observed value, its baseline and evidence links.
// Flags are "worth a closer look" — timing patterns, never evidence of cause.

import { addQuarters, quarterIndex, quarterOf, quarterRange, median } from "./quarters";

export const RULES = {
  WINDOW_BEFORE_Q: 2, // quarters before a decision quarter
  WINDOW_AFTER_Q: 2, // quarters after a decision quarter (spend rule only)
  SPEND_ABOVE_PCT: 25, // % above the company's own trailing median
  BASELINE_Q: 8, // trailing quarters used for the spend baseline
  BASELINE_MIN_Q: 4, // minimum quarters needed to compute a baseline
  CONTRIB_LOOKBACK_MONTHS: 24, // contributions to a decision participant within this many months before it
} as const;

export const RULE_TEXT: Record<string, { title: string; how: string }> = {
  spend_above_own_baseline: {
    title: "Lobbying spend above the company's own baseline",
    how: `A quarter's reported lobbying (each series separately) is at least ${RULES.SPEND_ABOVE_PCT}% above the median of the same series over the ${RULES.BASELINE_Q} preceding quarters, and the quarter falls within ${RULES.WINDOW_BEFORE_Q} quarters before or ${RULES.WINDOW_AFTER_Q} after a decision.`,
  },
  issue_named_near_decision: {
    title: "New case-related lobbying text that lists the decision-making body",
    how: `A registrant files case-related lobbying text (glyphosate or pesticide policy) that it had not used before, listing the body that made the decision among the bodies contacted, in the decision quarter or the ${RULES.WINDOW_BEFORE_Q} quarters before it. Baseline: the company's average number of such new texts per quarter. Repeated, unchanged texts are not flagged because they appear every quarter.`,
  },
  new_outside_firm: {
    title: "New outside lobbying firm before a decision",
    how: `An outside firm reports lobbying for the company for the first time in the decision quarter or the ${RULES.WINDOW_BEFORE_Q} quarters before it. Baseline: the company's average number of new firms per quarter.`,
  },
  revolving_door_overlap: {
    title: "Lobbyist's prior government role is in the decision-making body",
    how: `A lobbyist listed on case-related activity within ${RULES.WINDOW_BEFORE_Q} quarters of a decision reports a covered (prior government) position whose text names the body that made the decision.`,
  },
  contribution_to_decision_participant: {
    title: "Contributions to an official who took part in a decision",
    how: `Company-affiliated PAC contributions (or lobbyist contributions reported on LD-203) to a federal official who filed or issued a decision, within ${RULES.CONTRIB_LOOKBACK_MONTHS} months before it. Baseline: the PAC's median contribution total per federal recipient over the same period.`,
  },
};

export const FLAG_FOOTNOTE = "Worth a closer look. This is a timing pattern in public records, not evidence that one thing caused another.";

export interface DecisionIn { id: string; title: string; date: string; tier: "decision" | "event"; ldaEntities: string[]; bodyKeywords: string[] }
export interface SpendIn { quarter: string; inHouse: number | null; outside: number | null; filings: { inHouse: string[]; outside: string[] } }
export interface ActivityIn { id: string; quarter: string; relevance: string; pending: boolean; govEntities: string[]; registrant: string; excerpt: string; sourceUrl: string; lobbyistIds: string[] }
export interface FirmIn { id: string; name: string; firstQuarter: string; sourceUrl: string }
export interface LobbyistIn { id: string; name: string; coveredPositions: Array<{ text: string; sourceUrl: string }> }
export interface ContributionIn { officialId: string; officialName: string; decisionId: string; date: string; amount: number; label: string; sourceUrl: string }
export interface RecipientTotalIn { recipient: string; total: number; dateFrom: string; dateTo: string }

export interface FlagOut {
  id: string;
  rule: keyof typeof RULE_TEXT;
  subjectId: string;
  decisionIds: string[];
  window: string;
  observed: Record<string, unknown>;
  baseline: Record<string, unknown>;
  evidence: Array<{ label: string; url: string }>;
  wording: string;
  pendingReview: boolean;
}

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const isRelevant = (a: ActivityIn) => a.relevance === "glyphosate_direct" || a.relevance === "pesticide_policy";
const decisionsOnly = (ds: DecisionIn[]) => ds.filter((d) => d.tier === "decision");

/** Rule 1 */
export function spendAboveOwnBaseline(subjectId: string, decisions: DecisionIn[], spend: SpendIn[]): FlagOut[] {
  const byQ = new Map(spend.map((s) => [s.quarter, s]));
  const out: FlagOut[] = [];
  const ds = decisionsOnly(decisions);
  const candidateQuarters = new Set<string>();
  for (const d of ds) {
    const dq = quarterOf(d.date);
    for (const q of quarterRange(addQuarters(dq, -RULES.WINDOW_BEFORE_Q), addQuarters(dq, RULES.WINDOW_AFTER_Q))) candidateQuarters.add(q);
  }
  for (const q of [...candidateQuarters].sort()) {
    const row = byQ.get(q);
    if (!row) continue;
    for (const series of ["inHouse", "outside"] as const) {
      const v = row[series];
      if (v == null) continue;
      const prior = quarterRange(addQuarters(q, -RULES.BASELINE_Q), addQuarters(q, -1)).map((p) => byQ.get(p)?.[series]).filter((x): x is number => x != null);
      if (prior.length < RULES.BASELINE_MIN_Q) continue;
      const base = median(prior)!;
      if (base <= 0) continue;
      const pct = ((v - base) / base) * 100;
      if (pct < RULES.SPEND_ABOVE_PCT) continue;
      const near = ds.filter((d) => {
        const diff = quarterIndex(q) - quarterIndex(quarterOf(d.date));
        return diff >= -RULES.WINDOW_BEFORE_Q && diff <= RULES.WINDOW_AFTER_Q;
      });
      const label = series === "inHouse" ? "in-house reported expenses" : "outside firms' reported income";
      out.push({
        id: `spend:${subjectId}:${series}:${q}`,
        rule: "spend_above_own_baseline",
        subjectId,
        decisionIds: near.map((d) => d.id),
        window: q,
        observed: { quarter: q, series: label, amount: v },
        baseline: { method: `median of ${prior.length} preceding quarters`, median: base, percentAbove: Math.round(pct) },
        evidence: row.filings[series].map((url, i) => ({ label: `LD-2 filing ${i + 1} (${q})`, url })),
        wording: `Reported lobbying (${label}) in ${q} was ${usd(v)}, ${Math.round(pct)}% above this company's own median of ${usd(base)} for the ${prior.length} preceding quarters. ${q} is within the window of: ${near.map((d) => `${d.title} (${d.date})`).join("; ")}.`,
        pendingReview: false,
      });
    }
  }
  return out;
}

/** Rule 2 */
export function issueNamedNearDecision(subjectId: string, decisions: DecisionIn[], activities: ActivityIn[], allQuarters: string[]): FlagOut[] {
  const out: FlagOut[] = [];
  // First quarter each (registrant, text) appears. Texts present in the first quarter of the data are not "new".
  const firstSeen = new Map<string, string>();
  for (const a of [...activities].sort((x, y) => x.quarter.localeCompare(y.quarter))) {
    const k = `${a.registrant}|${a.excerpt.trim().replace(/\s+/g, " ")}`;
    if (!firstSeen.has(k)) firstSeen.set(k, a.quarter);
  }
  const start = allQuarters[0];
  const isNew = (a: ActivityIn) => {
    const q = firstSeen.get(`${a.registrant}|${a.excerpt.trim().replace(/\s+/g, " ")}`);
    return q === a.quarter && q !== start;
  };
  for (const d of decisionsOnly(decisions)) {
    if (!d.ldaEntities.length) continue;
    const dq = quarterOf(d.date);
    const from = addQuarters(dq, -RULES.WINDOW_BEFORE_Q);
    const matches = (a: ActivityIn) => isRelevant(a) && isNew(a) && a.govEntities.some((g) => d.ldaEntities.includes(g));
    const hits = activities.filter((a) => matches(a) && quarterIndex(a.quarter) >= quarterIndex(from) && quarterIndex(a.quarter) <= quarterIndex(dq));
    if (!hits.length) continue;
    const earlierQs = allQuarters.filter((q) => q !== start && quarterIndex(q) < quarterIndex(from));
    const earlierCount = activities.filter((a) => matches(a) && quarterIndex(a.quarter) < quarterIndex(from)).length;
    const avg = earlierQs.length ? earlierCount / earlierQs.length : 0;
    const qn = RULES.WINDOW_BEFORE_Q + 1;
    const bodies = [...new Set(hits.flatMap((a) => a.govEntities.filter((g) => d.ldaEntities.includes(g))))];
    const quarters = [...new Set(hits.map((a) => a.quarter))].sort();
    out.push({
      id: `issue:${subjectId}:${d.id}`,
      rule: "issue_named_near_decision",
      subjectId,
      decisionIds: [d.id],
      window: `${from} .. ${dq}`,
      observed: { newTexts: hits.length, quarters, bodies },
      baseline: { averageNewTextsPerQuarter: Number(avg.toFixed(2)), expectedInWindow: Number((avg * qn).toFixed(2)), earlierQuarters: earlierQs.length },
      evidence: dedupeEvidence(hits.map((a) => ({ label: `${a.quarter} · ${a.registrant}: "${a.excerpt.slice(0, 160)}${a.excerpt.length > 160 ? "…" : ""}"`, url: a.sourceUrl }))),
      wording: `${hits.length} new case-related lobbying ${hits.length === 1 ? "text" : "texts"} (first used in ${quarters.join(", ")}) listed ${bodies.join(", ")} among the bodies contacted — offices that correspond to the maker of "${d.title}" (${d.date}). Earlier, the company filed on average ${avg.toFixed(2)} such new texts per quarter (about ${(avg * qn).toFixed(1)} expected in a ${qn}-quarter window).`,
      pendingReview: hits.some((a) => a.pending),
    });
  }
  return out;
}

/** Rule 3 */
export function newOutsideFirm(subjectId: string, decisions: DecisionIn[], firms: FirmIn[], allQuarters: string[]): FlagOut[] {
  if (!allQuarters.length) return [];
  const windowStart = allQuarters[0];
  const counted = firms.filter((f) => f.firstQuarter !== windowStart); // firms already present at the start are not "new"
  const avg = counted.length / Math.max(1, allQuarters.length - 1);
  const out: FlagOut[] = [];
  for (const d of decisionsOnly(decisions)) {
    const dq = quarterOf(d.date);
    const from = addQuarters(dq, -RULES.WINDOW_BEFORE_Q);
    const hits = counted.filter((f) => quarterIndex(f.firstQuarter) >= quarterIndex(from) && quarterIndex(f.firstQuarter) <= quarterIndex(dq));
    if (!hits.length) continue;
    const qn = RULES.WINDOW_BEFORE_Q + 1;
    out.push({
      id: `newfirm:${subjectId}:${d.id}`,
      rule: "new_outside_firm",
      subjectId,
      decisionIds: [d.id],
      window: `${from} .. ${dq}`,
      observed: { newFirms: hits.map((f) => ({ name: f.name, firstQuarter: f.firstQuarter })) },
      baseline: { averageNewFirmsPerQuarter: Number(avg.toFixed(2)), expectedInWindow: Number((avg * qn).toFixed(2)), quartersInWindow: qn },
      evidence: hits.map((f) => ({ label: `${f.name} — first LD-2 for this client (${f.firstQuarter})`, url: f.sourceUrl })),
      wording: `${hits.length} outside lobbying ${hits.length === 1 ? "firm" : "firms"} (${hits.map((f) => f.name).join(", ")}) first reported lobbying for this company between ${from} and ${dq}, around "${d.title}" (${d.date}). The company's average is ${avg.toFixed(2)} new firms per quarter (about ${(avg * qn).toFixed(1)} expected in a ${qn}-quarter window).`,
      pendingReview: false,
    });
  }
  return out;
}

/** Rule 4 */
export function revolvingDoorOverlap(subjectId: string, decisions: DecisionIn[], activities: ActivityIn[], lobbyists: LobbyistIn[]): FlagOut[] {
  const byId = new Map(lobbyists.map((l) => [l.id, l]));
  const out: FlagOut[] = [];
  for (const d of decisionsOnly(decisions)) {
    if (!d.bodyKeywords.length) continue;
    const re = new RegExp(d.bodyKeywords.join("|"), "i");
    const dq = quarterOf(d.date);
    const acts = activities.filter((a) => isRelevant(a) && Math.abs(quarterIndex(a.quarter) - quarterIndex(dq)) <= RULES.WINDOW_BEFORE_Q);
    const ids = new Set(acts.flatMap((a) => a.lobbyistIds));
    const hits: Array<{ lobbyist: LobbyistIn; position: { text: string; sourceUrl: string } }> = [];
    for (const id of ids) {
      const l = byId.get(id);
      if (!l) continue;
      for (const p of l.coveredPositions) if (re.test(p.text)) hits.push({ lobbyist: l, position: p });
    }
    if (!hits.length) continue;
    const withAny = [...ids].filter((id) => (byId.get(id)?.coveredPositions.length ?? 0) > 0).length;
    out.push({
      id: `revolving:${subjectId}:${d.id}`,
      rule: "revolving_door_overlap",
      subjectId,
      decisionIds: [d.id],
      window: `${addQuarters(dq, -RULES.WINDOW_BEFORE_Q)} .. ${addQuarters(dq, RULES.WINDOW_BEFORE_Q)}`,
      observed: { lobbyists: hits.map((h) => ({ name: h.lobbyist.name, coveredPosition: h.position.text })) },
      baseline: { lobbyistsOnCaseActivityInWindow: ids.size, ofWhichListAnyCoveredPosition: withAny },
      evidence: hits.map((h) => ({ label: `${h.lobbyist.name}: "${h.position.text}"`, url: h.position.sourceUrl })),
      wording: `${hits.length === 1 ? "A lobbyist" : `${hits.length} lobbyists`} on case-related activity near "${d.title}" (${d.date}) ${hits.length === 1 ? "lists" : "list"} a prior government role whose text names the decision-making body. Of the ${ids.size} lobbyists on case-related activity in that window, ${withAny} list any prior government role. Former officials may legally lobby; this does not suggest any rule was broken.`,
      pendingReview: acts.some((a) => a.pending),
    });
  }
  return out;
}

/** Rule 5 */
export function contributionToDecisionParticipant(subjectId: string, decisions: DecisionIn[], contributions: ContributionIn[], recipientTotals: RecipientTotalIn[]): FlagOut[] {
  const out: FlagOut[] = [];
  const dById = new Map(decisions.map((d) => [d.id, d]));
  const groups = new Map<string, ContributionIn[]>();
  for (const c of contributions) groups.set(`${c.officialId}|${c.decisionId}`, [...(groups.get(`${c.officialId}|${c.decisionId}`) ?? []), c]);
  for (const [key, items] of groups) {
    const d = dById.get(items[0].decisionId);
    if (!d || d.tier !== "decision") continue;
    const end = new Date(d.date);
    const start = new Date(end);
    start.setUTCMonth(start.getUTCMonth() - RULES.CONTRIB_LOOKBACK_MONTHS);
    const inWin = items.filter((c) => new Date(c.date) >= start && new Date(c.date) <= end).sort((a, b) => a.date.localeCompare(b.date));
    if (!inWin.length) continue;
    const total = inWin.reduce((s, c) => s + c.amount, 0);
    const base = median(recipientTotals.map((r) => r.total));
    out.push({
      id: `contrib:${subjectId}:${key}`,
      rule: "contribution_to_decision_participant",
      subjectId,
      decisionIds: [d.id],
      window: `${start.toISOString().slice(0, 10)} .. ${d.date}`,
      observed: { official: items[0].officialName, contributions: inWin.length, total },
      baseline: { medianTotalPerFederalRecipient: base, recipients: recipientTotals.length },
      evidence: inWin.map((c) => ({ label: `${c.date} · ${usd(c.amount)} · ${c.label}`, url: c.sourceUrl })),
      wording: `${inWin.length} contribution${inWin.length === 1 ? "" : "s"} totalling ${usd(total)} went to ${items[0].officialName} in the ${RULES.CONTRIB_LOOKBACK_MONTHS} months before "${d.title}" (${d.date}), a decision this official took part in. For comparison, the median total per federal recipient over the same period was ${base == null ? "n/a" : usd(base)} across ${recipientTotals.length} recipients.`,
      pendingReview: false,
    });
  }
  return out;
}

function dedupeEvidence(e: Array<{ label: string; url: string }>) {
  const seen = new Set<string>();
  return e.filter((x) => (seen.has(x.label) ? false : (seen.add(x.label), true)));
}

/** Merge flags of the same rule whose evidence is identical (overlapping decision windows). */
export function mergeOverlapping(flags: FlagOut[], decisions: DecisionIn[]): FlagOut[] {
  const byKey = new Map<string, FlagOut[]>();
  for (const f of flags) {
    const k = `${f.rule}|${f.evidence.map((e) => e.label + e.url).sort().join("||")}`;
    byKey.set(k, [...(byKey.get(k) ?? []), f]);
  }
  const out: FlagOut[] = [];
  for (const group of byKey.values()) {
    if (group.length === 1 || group[0].rule === "spend_above_own_baseline") { out.push(...group); continue; }
    const ids = [...new Set(group.flatMap((g) => g.decisionIds))];
    const titles = ids.map((id) => decisions.find((d) => d.id === id)).filter(Boolean).map((d) => `"${d!.title}" (${d!.date})`);
    const first = group[0];
    out.push({
      ...first,
      id: `${first.rule}:${first.subjectId}:${ids.join("+")}`,
      decisionIds: ids,
      window: [...new Set(group.map((g) => g.window))].join("; "),
      wording: first.wording.replace(/"[^"]+" \(\d{4}-\d{2}-\d{2}\)/, titles.join(", ")),
      pendingReview: group.some((g) => g.pendingReview),
    });
  }
  return out;
}

export function runAllRules(input: {
  subjectId: string; decisions: DecisionIn[]; spend: SpendIn[]; activities: ActivityIn[]; firms: FirmIn[]; lobbyists: LobbyistIn[];
  contributions: ContributionIn[]; recipientTotals: RecipientTotalIn[]; allQuarters: string[];
}): FlagOut[] {
  const { subjectId, decisions } = input;
  return mergeOverlapping([
    ...spendAboveOwnBaseline(subjectId, decisions, input.spend),
    ...issueNamedNearDecision(subjectId, decisions, input.activities, input.allQuarters),
    ...newOutsideFirm(subjectId, decisions, input.firms, input.allQuarters),
    ...revolvingDoorOverlap(subjectId, decisions, input.activities, input.lobbyists),
    ...contributionToDecisionParticipant(subjectId, decisions, input.contributions, input.recipientTotals),
  ], decisions);
}
