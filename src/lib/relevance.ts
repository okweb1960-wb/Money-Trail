// Screening classifier for LD-2 lobbying activity text.
// It only PROPOSES a label; a person confirms it in data/review/lda-activities.csv.
//
//  glyphosate_direct  — the text names glyphosate or Roundup.
//  pesticide_policy   — the text is about pesticide law/regulation (FIFRA, pesticide registration,
//                       pesticide/agricultural labeling uniformity, preemption of pesticide labeling),
//                       which is the legal question in the Supreme Court case.
//  general            — anything else (including "labeling uniformity" for medicines or food).

export type Relevance = "glyphosate_direct" | "pesticide_policy" | "general";

const DIRECT = [/\bglyphosate\b/i, /\broundup\b/i];
const PESTICIDE = [
  /\bfifra\b/i,
  /insecticide,?\s+fungicide/i,
  /\bpesticides?\b/i,
  /\bherbicides?\b/i,
  /\bcrop protection\b/i,
  /\bagricultural labeling uniformity\b/i,
];

export function classifyActivity(text: string | null | undefined): { relevance: Relevance; matched: string[] } {
  const t = text ?? "";
  const matched: string[] = [];
  for (const r of DIRECT) if (r.test(t)) matched.push(r.source.replace(/\\b|\\s\+|\?/g, ""));
  if (matched.length) return { relevance: "glyphosate_direct", matched };
  for (const r of PESTICIDE) if (r.test(t)) matched.push(r.source.replace(/\\b|\\s\+|,\?|\?/g, ""));
  if (matched.length) return { relevance: "pesticide_policy", matched };
  return { relevance: "general", matched };
}

export const isCaseRelevant = (r: string) => r === "glyphosate_direct" || r === "pesticide_policy";
