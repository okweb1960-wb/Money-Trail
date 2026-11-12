import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

export const RAW_DIR = join(process.cwd(), "data", "raw");

/** A raw snapshot: what we asked for, when, and what came back. */
export interface RawFile<T> {
  source: string;
  retrieved_at: string;
  requests: Array<{ url: string; retrieved_at: string }>;
  data: T;
}

export function writeRaw<T>(relPath: string, raw: RawFile<T>) {
  const p = join(RAW_DIR, relPath);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(raw) + "\n");
  console.log(`  wrote data/raw/${relPath}`);
}

export function readRaw<T>(relPath: string): RawFile<T> {
  const p = join(RAW_DIR, relPath);
  if (!existsSync(p)) throw new Error(`Missing data/raw/${relPath}. Run the matching fetch script first (npm run fetch).`);
  return JSON.parse(readFileSync(p, "utf8"));
}
