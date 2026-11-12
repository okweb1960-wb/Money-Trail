// Fetch the Supreme Court docket JSON for the case and the text of the U.S. briefs' conclusions.
// Writes data/raw/scotus/docket.json and data/raw/scotus/documents.json.
// Run: npm run fetch:scotus
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchJson } from "../lib/http";
import { writeRaw } from "../lib/raw";
import { loadCase } from "../lib/case";

async function pdfText(url: string): Promise<string | null> {
  // Uses pdftotext (poppler) when available. On Windows without poppler this returns null,
  // and the loader falls back to the docket text only.
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) return null;
  const dir = mkdtempSync(join(tmpdir(), "mt-"));
  const p = join(dir, "doc.pdf");
  writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  try {
    return execFileSync("pdftotext", ["-layout", p, "-"], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const c = loadCase();
  const url = `https://www.supremecourt.gov/RSS/Cases/JSON/${c.scotus.docket}.json`;
  const r = await fetchJson<any>(url);
  const d = r.data;
  if (!new RegExp(c.scotus.expect_petitioner, "i").test(d.PetitionerTitle) || !new RegExp(c.scotus.expect_respondent, "i").test(d.RespondentTitle)) {
    throw new Error(`Docket ${c.scotus.docket} is "${d.PetitionerTitle} v. ${d.RespondentTitle}" — does not match the case config`);
  }
  writeRaw("scotus/docket.json", { source: "Supreme Court of the United States docket JSON", retrieved_at: r.retrieved_at, requests: [{ url, retrieved_at: r.retrieved_at }], data: d });

  // Extract the conclusion / holding text of key documents (briefs + opinion syllabus).
  const entries: any[] = d.ProceedingsandOrder ?? [];
  const docs: any[] = [];
  for (const cfg of c.decisions.filter((x) => x.conclusionPattern || x.key === "opinion")) {
    const hits = entries.filter((e) => new RegExp(cfg.match!, "i").test(e.Text));
    const e = hits[cfg.nth ?? 0];
    if (!e) continue;
    const docUrl = cfg.key === "opinion" ? e.Text.match(/href\s*=\s*'([^']+)'/)?.[1] : e.Links?.find((l: any) => l.Description === "Main Document")?.DocumentUrl;
    if (!docUrl) continue;
    const text = await pdfText(docUrl);
    let excerpt: string | null = null;
    if (text) {
      const flat = text.replace(/\s+/g, " ");
      if (cfg.conclusionPattern) {
        const all = [...flat.matchAll(new RegExp(cfg.conclusionPattern, "g"))];
        excerpt = all.length ? all[all.length - 1][1].trim() : null; // the last CONCLUSION is the brief's own (the first is the table of contents)
      } else {
        excerpt = flat.match(/Held: (.+?)(?= Pp\. \d)/)?.[1]?.trim() ?? null;
      }
    }
    docs.push({ key: cfg.key, url: docUrl, excerpt, retrieved_at: new Date().toISOString() });
    console.log(`  ${cfg.key}: ${excerpt ? excerpt.slice(0, 80) + "…" : "(no text extracted)"}`);
  }
  writeRaw("scotus/documents.json", { source: "Supreme Court of the United States (DocketPDF / opinions)", retrieved_at: new Date().toISOString(), requests: docs.map((x) => ({ url: x.url, retrieved_at: x.retrieved_at })), data: docs });
}

main().catch((e) => { console.error(e); process.exit(1); });
