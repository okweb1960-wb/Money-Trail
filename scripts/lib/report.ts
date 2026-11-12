import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stats } from "./http";

export const OUT_DIR = join(process.cwd(), "data", "feasibility");

export interface SourceReport {
  source: string;
  generated_at: string;
  window: { from: string; to: string };
  base_urls: string[];
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; detail: string; source_url?: string }>;
  rate_limits: Record<string, unknown>;
  gaps: string[];
  findings: Record<string, unknown>;
  http_stats?: Record<string, number>;
}

export function writeReport(name: string, report: SourceReport) {
  mkdirSync(OUT_DIR, { recursive: true });
  report.http_stats = { ...stats };
  const path = join(OUT_DIR, `${name}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
  console.log(`\nWrote ${path}`);
  for (const c of report.checks) console.log(`  [${c.ok ? "OK " : "FAIL"}] ${c.name}: ${c.detail}`);
  if (report.gaps.length) console.log("  Gaps:\n" + report.gaps.map((g) => "   - " + g).join("\n"));
}

/** Window for v1: from Bayer's acquisition year of Monsanto (2018) through today. */
export const WINDOW = { fromYear: 2018, toYear: new Date().getFullYear() };
