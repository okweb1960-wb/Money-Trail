// Copy lint: fails if UI source code uses causal, accusatory or partisan wording.
// Data (verbatim filing text) is not linted — only the strings we write.
// Run: npm run lint:copy
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const BANNED: Array<[RegExp, string]> = [
  [/\bcaus(e|ed|es|ing)\b(?! (?:one|any|the|a) )/i, "causal claim"],
  [/\bbought\b|\bbuy(?:s|ing)? (?:a |the )?(?:decision|ruling|policy|official)/i, "purchase framing"],
  [/\bcorrupt(ion|ed)?\b/i, "verdict"],
  [/\bpaid for\b|\bin exchange for\b|\bquid pro quo\b|\bbribe/i, "exchange framing"],
  [/\b(democrat(ic)?|republican|liberal|conservative|left-wing|right-wing|gop)\b/i, "partisan label"],
];
// Allowed phrases (e.g. the disclaimer itself says money did NOT cause anything).
const ALLOW = [/not (?:evidence )?(?:that )?(?:one thing )?caused/i, /does not (?:say|claim) that money caused/i, /correlation is not causation/i, /not evidence of cause/i, /never says that money caused/i];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (p.includes("generated")) return [];
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|md)$/.test(p) && !p.endsWith(".test.ts") ? [p] : [];
  });
}

let problems = 0;
for (const file of walk(join(process.cwd(), "src"))) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (line.trim().startsWith("//")) return;
    for (const [re, why] of BANNED) {
      if (re.test(line) && !ALLOW.some((a) => a.test(line))) {
        problems++;
        console.log(`${file.replace(process.cwd() + "/", "")}:${i + 1}  [${why}]  ${line.trim().slice(0, 140)}`);
      }
    }
  });
}
if (problems) { console.log(`\n${problems} wording problem(s).`); process.exit(1); }
console.log("Copy lint: no banned wording in UI source.");
