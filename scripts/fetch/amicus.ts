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
    const cover = await coverText(url);
    // Only the cover is used: stop at the table of contents so later text can't be mistaken for the cover.
    const coverOnly = cover ? cover.split(/TABLE OF CONTENTS|QUESTION PRESENTED|INTEREST OF AMIC/i)[0] : null;
    const { side, phrase } = coverOnly ? sideFromCover(coverOnly, c.scotus.expect_petitioner, c.scotus.expect_respondent) : { side: "not_stated" as Side, phrase: null };
    out.push({ filer: m[1].trim(), docketDate: e.Date, docketText: text, url, side, coverPhrase: phrase, retrieved_at: new Date().toISOString() });
    console.log(`  ${e.Date} | ${m[1].trim().slice(0, 50).padEnd(50)} | ${side}${phrase ? ` ("${phrase}")` : ""}`);
    await new Promise((r) => setTimeout(r, 500));
  }
  writeRaw("scotus/amicus-briefs.json", { source: "Supreme Court of the United States (amicus brief cover pages)", retrieved_at: new Date().toISOString(), requests: out.map((x) => ({ url: x.url, retrieved_at: x.retrieved_at })), data: out });
}

if (process.argv[1]?.endsWith("amicus.ts")) main().catch((e) => { console.error(e); process.exit(1); });
