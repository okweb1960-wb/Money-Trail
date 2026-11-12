// Minimal RFC-4180 CSV read/write (quotes, commas, newlines inside quotes). Opens fine in Excel.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

export function toCsv(rows: Array<Record<string, string | number | null | undefined>>, headers: string[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\r\n") + "\r\n";
}

export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  if (cur !== "" || row.length) {
    row.push(cur);
    if (row.some((c) => c !== "")) rows.push(row);
  }
  if (!rows.length) return [];
  const [h, ...rest] = rows;
  return rest.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ""])));
}

export function readCsvIfExists(path: string) {
  return existsSync(path) ? parseCsv(readFileSync(path, "utf8")) : [];
}

export function writeCsv(path: string, rows: Array<Record<string, string | number | null | undefined>>, headers: string[]) {
  writeFileSync(path, "﻿" + toCsv(rows, headers));
}
