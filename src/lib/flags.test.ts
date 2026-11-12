import { test } from "node:test";
import assert from "node:assert/strict";
import { runAllRules, spendAboveOwnBaseline, type DecisionIn, type SpendIn, type ActivityIn } from "./flags";
import { quarterRange } from "./quarters";

const quarters = quarterRange("2023-Q1", "2025-Q4");
const spend: SpendIn[] = quarters.map((q, i) => ({ quarter: q, inHouse: q === "2025-Q2" ? 200 : 100 + (i % 2), outside: 50, filings: { inHouse: [`https://example.test/${q}`], outside: [] } }));
const decision = (id: string, date: string, extra: Partial<DecisionIn> = {}): DecisionIn => ({ id, title: `Decision ${id}`, date, tier: "decision", ldaEntities: ["BODY A"], bodyKeywords: ["body a"], ...extra });

test("spend rule flags a quarter well above the company's own median, near a decision", () => {
  const flags = spendAboveOwnBaseline("co", [decision("d1", "2025-05-15")], spend);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].window, "2025-Q2");
  assert.ok((flags[0].baseline.percentAbove as number) >= 25);
});

test("spend rule ignores the same spike when no decision is near it", () => {
  assert.equal(spendAboveOwnBaseline("co", [decision("d1", "2023-06-01")], spend).length, 0);
});

test("event-tier items never produce flags", () => {
  assert.equal(spendAboveOwnBaseline("co", [decision("d1", "2025-05-15", { tier: "event" })], spend).length, 0);
});

// Symmetry: the rules must give the same result whoever the actors are.
// Swap every name/label for a different one (as if the parties or administrations were reversed)
// and check that the flags are identical apart from those labels.
test("rules are symmetric: renaming actors does not change which flags fire or their numbers", () => {
  const acts = (body: string, who: string): ActivityIn[] => [
    { id: "a1", quarter: "2025-Q1", relevance: "glyphosate_direct", pending: false, govEntities: [body], registrant: who, excerpt: "x", sourceUrl: "https://example.test/a1", lobbyistIds: ["l1"] },
  ];
  const run = (body: string, who: string, official: string) =>
    runAllRules({
      subjectId: "co",
      decisions: [decision("d1", "2025-05-15", { ldaEntities: [body], bodyKeywords: [body.toLowerCase()] })],
      spend,
      activities: acts(body, who),
      firms: [{ id: "f1", name: who, firstQuarter: "2025-Q1", sourceUrl: "https://example.test/f1" }],
      lobbyists: [{ id: "l1", name: "Lobbyist", coveredPositions: [{ text: `Staff, ${body}`, sourceUrl: "https://example.test/cp" }] }],
      contributions: [{ officialId: "o1", officialName: official, decisionId: "d1", date: "2025-01-10", amount: 1000, label: "PAC", sourceUrl: "https://example.test/c" }],
      recipientTotals: [{ recipient: "r1", total: 500, dateFrom: "2023-05-15", dateTo: "2025-05-15" }],
      allQuarters: quarters,
    });
  const a = run("Party One Office", "Firm Red", "Official from Party One");
  const b = run("Party Two Office", "Firm Blue", "Official from Party Two");
  const shape = (fs: ReturnType<typeof run>) => fs.map((f) => ({ rule: f.rule, window: f.window, n: f.evidence.length, base: JSON.stringify(f.baseline) }));
  assert.deepEqual(shape(a), shape(b));
  assert.equal(a.length, 5, "each of the five rules fires once on this synthetic case");
});
