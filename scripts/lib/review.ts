// Shared helpers for the human-review files in data/review/.
import { join } from "node:path";
import { readCsvIfExists } from "./csv";

// Proposal pattern for corporate Bayer / Monsanto client names on LDA filings.
export const COMPANY_NAME = /\b(BAYER\s+(U\.?\s?S\.?|CORP|CROP|AG\b|HEALTHCARE|MATERIAL|HOLDING|CONSOLIDATED)|THE BAYER CORPORATION|MONSANTO)/i;

export function activityKey(registrant: string, description: string) {
  return `${registrant}|${description.trim().replace(/\s+/g, " ")}`;
}

export type Review = "approved" | "proposed" | "rejected";
const DIR = join(process.cwd(), "data", "review");

/** Client alias decisions: alias -> { include, review } */
export function loadAliasDecisions() {
  const rows = readCsvIfExists(join(DIR, "lda-client-aliases.csv"));
  const out = new Map<string, { include: boolean; review: Review }>();
  for (const r of rows) {
    const a = r.approved.trim().toLowerCase();
    if (a === "yes" || a === "no") out.set(r.alias, { include: a === "yes", review: a === "yes" ? "approved" : "rejected" });
    else out.set(r.alias, { include: r.proposed === "yes", review: "proposed" });
  }
  return out;
}

/** Activity relevance decisions: key -> { relevance, review } */
export function loadActivityDecisions() {
  const rows = readCsvIfExists(join(DIR, "lda-activities.csv"));
  const valid = new Set(["glyphosate_direct", "pesticide_policy", "general"]);
  const out = new Map<string, { relevance: string; review: Review }>();
  for (const r of rows) {
    const a = r.approved.trim();
    if (valid.has(a)) out.set(r.key, { relevance: a, review: "approved" });
    else out.set(r.key, { relevance: r.proposed, review: "proposed" });
  }
  return out;
}

/** Revolving-door overlap notes: "<lda lobbyist id>|<covered position>" -> { note, review } */
export function loadOverlapDecisions() {
  const rows = readCsvIfExists(join(DIR, "revolving-door.csv"));
  const out = new Map<string, { note: string | null; review: Review }>();
  for (const r of rows) {
    const a = (r.approved_overlap ?? "").trim();
    if (a) out.set(r.key, { note: a.toLowerCase() === "none" ? null : a, review: "approved" });
    else out.set(r.key, { note: r.proposed_overlap || null, review: "proposed" });
  }
  return out;
}
