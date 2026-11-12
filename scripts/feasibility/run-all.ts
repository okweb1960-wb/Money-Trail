// Runs every Phase 0 feasibility script in sequence. Each writes data/feasibility/<source>.json.
// Run: npm run feasibility
import { spawnSync } from "node:child_process";

const scripts = ["federal-register", "scotus", "fec", "lda"];
let failed = 0;
for (const s of scripts) {
  console.log(`\n=== ${s} ===`);
  const r = spawnSync(process.execPath, ["--import", "tsx", `scripts/feasibility/${s}.ts`], { stdio: "inherit" });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} script(s) failed` : "\nAll feasibility scripts finished");
process.exit(failed ? 1 : 0);
