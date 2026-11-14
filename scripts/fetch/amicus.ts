// For every amicus brief on the case docket, read the brief's cover page and record the side it
// states (e.g. "in support of petitioner"). The exact cover phrase is stored so it can be shown
// verbatim; nothing is inferred when the cover does not state a side.
// Writes data/raw/scotus/amicus-briefs.json. Needs pdftotext (poppler); on Windows without it, the
// script stops and the existing snapshot is kept.
// Run: npm run fetch:amicus
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readRaw, writeRaw } from "../lib/raw";
import { loadCase } from "../lib/case";

const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
export type Side = "petitioner" | "respondent" | "neither" | "not_stated";

/** Side stated on a brief's cover: "in support of / supporting" + petitioner | respondent | neither party,
 *  or + a party's name (e.g. "in support of Monsanto Company"). Party names come from the case config. */
export function sideFromCover(cover: string, petitionerName: string, respondentName: string): { side: Side; phrase: string | null } {
  const flat = cover.replace(/-\s+/g, "").replace(/\s+/g, " ");
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffix = "(?:\\s+(?:COMPANY|CO\\.|INC\\.?|CORPORATION|LLC))?";
  const re = new RegExp(`\\b(IN SUPPORT OF|SUPPORTING)\\s+(?:THE\\s+)?(PETITIONERS?|RESPONDENTS?|NEITHER\\s+PARTY|${esc(petitionerName)}${suffix}|(?:[A-Z]+\\.?\\s+){0,2}${esc(respondentName)})\\b`, "i");
  const m = flat.match(re);
  if (!m) return { side: "not_stated", phrase: null };
  const who = m[2].toUpperCase();
  const side: Side = who.startsWith("PETITIONER") || who.startsWith(petitionerName.toUpperCase()) ? "petitioner" : who.startsWith("RESPONDENT") || who.startsWith(respondentName.toUpperCase()) ? "respondent" : "neither";
  return { side, phrase: m[0].trim() };
}

export interface Disclosure {
  statement: string | null; // verbatim Rule 37.6 statement (sentences about authorship / money)
  partyCounselAuthoredDenied: boolean | null; // statement says no counsel for a party authored the brief
  membersExcepted: boolean | null; // money from the filer's own members is excluded from the "no other contributions" statement
  mentionsParty: string[]; // sentences in the statement that name a party or its parent company
  counselOverlap: string[]; // sentences disclosing that the brief's counsel (or their firm) represent a side in related litigation
}

const KEY = /(author|written|contribut|fund|member|dues|counsel|party|parties|Rule 37)/i;
// Phrases that open a Rule 37.6 statement.
const OPENERS = /(Pursuant to (?:this Court['’]s |Supreme Court )?Rule 37|Under (?:this Court['’]s |Supreme Court )?Rule 37|No counsel|No part of this brief|This brief was not written|No one other than|No person or entity|Counsel for amic)/gi;
const EMPTY: Disclosure = { statement: null, partyCounselAuthoredDenied: null, membersExcepted: null, mentionsParty: [], counselOverlap: [] };

/** Extract the Rule 37.6 authorship/funding statement verbatim from a brief's full text. */
export function extractDisclosure(fullText: string, partyNames: string[]): Disclosure {
  const t = fullText.replace(/(\w)-\s+(\w)/g, "$1$2").replace(/\s+/g, " ");
  const m = /(authored (?:this|the) brief|sole authors? of this brief|brief was (?:not )?(?:authored|written)|monetary contribution|contributed money)/i.exec(t);
  if (!m) return EMPTY;
  // Start at the last statement opener within 600 characters before the first match (else at that sentence).
  let start = Math.max(0, t.lastIndexOf(". ", m.index) + 2);
  const windowStart = Math.max(0, m.index - 600);
  let op: RegExpExecArray | null;
  OPENERS.lastIndex = windowStart;
  let best = -1;
  let bestRule = -1; // a "Pursuant to / Under ... Rule 37" opener wins when present
  while ((op = OPENERS.exec(t)) && op.index <= m.index) {
    best = op.index;
    if (/^(Pursuant|Under)/i.test(op[0])) bestRule = op.index;
  }
  if (bestRule >= 0) start = bestRule;
  else if (best >= 0) start = best;
  // Protect abbreviations so "Bayer Corp., is a member" stays one sentence.
  const ABBR = /\b(Corp|Inc|Co|Ltd|No|U\.S|L\.L\.P|LLP|P\.C|Jr|Sr|Dr|Mr|Ms|St)\./g;
  const rest = t.slice(start).replace(ABBR, (_m, a: string) => `${a.replace(/\./g, "\u2024")}\u2024`);
  // A period followed by a digit ("Rule 37.6") does not end a sentence.
  const sentences = (rest.match(/(?:[^.]|\.(?=\d))+(?:\.|$)/g) ?? []).map((x) => x.replace(/\u2024/g, "."));
  const keep: string[] = [];
  for (const sRaw of sentences.slice(0, 5)) {
    const s1 = sRaw.replace(/^\s*\d+\s+(?=[A-Z])/, "").trim(); // drop footnote marker
    if (!KEY.test(s1)) break;
    keep.push(s1);
    if (keep.length >= 4) break;
  }
  const statement = keep.join(" ").replace(/\s+\d+$/, "").trim();
  const party = new RegExp(`\\b(${partyNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");
  const denied = /(no (?:part of this brief was authored in whole or in part by counsel for|counsel (?:for|to) (?:a|any|either|the) part(?:y|ies))|not (?:written|authored) in whole or in part by counsel for (?:a|any|either) party)/i.test(statement);
  return {
    statement,
    partyCounselAuthoredDenied: denied ? true : null,
    membersExcepted: /\bmembers\b/i.test(statement),
    mentionsParty: keep.filter((x) => party.test(x)),
    // e.g. "counsel ... are counsel for Plaintiffs in other Roundup litigation" / "... are among counsel to Monsanto Company"
    counselOverlap: keep.filter((x) => /\b(?:are|is|serve[sd]?|represent\w*)\b[^.]{0,40}\bcounsel (?:to|for)\b/i.test(x) && !/^no counsel/i.test(x)),
  };
}

async function fullText(url: string): Promise<string | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) return null;
  const dir = mkdtempSync(join(tmpdir(), "mt-amicus-"));
  const p = join(dir, "brief.pdf");
  writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  try {
    return execFileSync("pdftotext", ["-layout", p, "-"], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function coverText(url: string): Promise<string | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) return null;
  const dir = mkdtempSync(join(tmpdir(), "mt-amicus-"));
  const p = join(dir, "brief.pdf");
  writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  try {
    // The first pages hold the cover (some briefs have a blank or notice page first).
    return execFileSync("pdftotext", ["-f", "1", "-l", "3", "-layout", p, "-"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  try {
    execFileSync("pdftotext", ["-v"], { stdio: "ignore" });
  } catch {
    console.error("pdftotext not found (install poppler). Keeping the existing data/raw/scotus/amicus-briefs.json.");
    process.exit(1);
  }
  const c = loadCase();
  const docket = readRaw<any>("scotus/docket.json");
  const out: any[] = [];
  for (const e of docket.data.ProceedingsandOrder ?? []) {
    const text = strip(e.Text);
    const m = text.match(/^Brief amic(?:us|i) curiae of (.+?) filed\./i);
    if (!m) continue;
    const url = e.Links?.find((l: any) => l.Description === "Main Document")?.DocumentUrl;
    if (!url) continue;
    const full = await fullText(url);
    const cover = full ? full.split("\f").slice(0, 3).join("\n") : await coverText(url);
    const disclosure = full ? extractDisclosure(full, [c.scotus.expect_petitioner, c.scotus.expect_respondent, ...(c.scotus.related_parties ?? [])]) : null;
    // Only the cover is used: stop at the table of contents so later text can't be mistaken for the cover.
    const coverOnly = cover ? cover.split(/TABLE OF CONTENTS|QUESTION PRESENTED|INTEREST OF AMIC/i)[0] : null;
    const { side, phrase } = coverOnly ? sideFromCover(coverOnly, c.scotus.expect_petitioner, c.scotus.expect_respondent) : { side: "not_stated" as Side, phrase: null };
    out.push({ filer: m[1].trim(), docketDate: e.Date, docketText: text, url, side, coverPhrase: phrase, disclosure, retrieved_at: new Date().toISOString() });
    console.log(`  ${e.Date} | ${m[1].trim().slice(0, 50).padEnd(50)} | ${side}${phrase ? ` ("${phrase}")` : ""}`);
    await new Promise((r) => setTimeout(r, 500));
  }
  writeRaw("scotus/amicus-briefs.json", { source: "Supreme Court of the United States (amicus brief cover pages)", retrieved_at: new Date().toISOString(), requests: out.map((x) => ({ url: x.url, retrieved_at: x.retrieved_at })), data: out });
}

if (process.argv[1]?.endsWith("amicus.ts")) main().catch((e) => { console.error(e); process.exit(1); });
