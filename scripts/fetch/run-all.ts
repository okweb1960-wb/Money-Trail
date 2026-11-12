// Runs every fetch script in sequence (LDA last: it is the slowest).
import { spawnSync } from "node:child_process";
let failed = 0;
for (const s of ["scotus", "federal-register", "fec", "lda"]) {
  console.log(`\n=== fetch:${s} ===`);
  const r = spawnSync(process.execPath, ["--import", "tsx", `scripts/fetch/${s}.ts`], { stdio: "inherit" });
  if (r.status !== 0) failed++;
}
process.exit(failed ? 1 : 0);
