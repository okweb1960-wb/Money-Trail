// Quarter helpers. A quarter key looks like "2025-Q3".

export type QuarterKey = `${number}-Q${1 | 2 | 3 | 4}`;

export function quarterOf(date: Date | string): QuarterKey {
  const d = typeof date === "string" ? new Date(date) : date;
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${d.getUTCFullYear()}-Q${q}` as QuarterKey;
}

export function parseQuarter(k: string): { year: number; q: number } {
  const m = /^(\d{4})-Q([1-4])$/.exec(k);
  if (!m) throw new Error(`Bad quarter key: ${k}`);
  return { year: Number(m[1]), q: Number(m[2]) };
}

export function quarterIndex(k: string): number {
  const { year, q } = parseQuarter(k);
  return year * 4 + (q - 1);
}

export function fromIndex(i: number): QuarterKey {
  return `${Math.floor(i / 4)}-Q${(i % 4) + 1}` as QuarterKey;
}

export function addQuarters(k: string, n: number): QuarterKey {
  return fromIndex(quarterIndex(k) + n);
}

export function quarterRange(from: string, to: string): QuarterKey[] {
  const out: QuarterKey[] = [];
  for (let i = quarterIndex(from); i <= quarterIndex(to); i++) out.push(fromIndex(i));
  return out;
}

export function quarterStart(k: string): Date {
  const { year, q } = parseQuarter(k);
  return new Date(Date.UTC(year, (q - 1) * 3, 1));
}

export function quarterEnd(k: string): Date {
  const { year, q } = parseQuarter(k);
  return new Date(Date.UTC(year, q * 3, 0));
}

const LDA_PERIOD: Record<string, number> = { first_quarter: 1, second_quarter: 2, third_quarter: 3, fourth_quarter: 4 };
/** LDA filing_period -> quarter key. Returns null for non-quarterly periods (pre-2008 semiannual). */
export function ldaQuarter(year: number, period: string): QuarterKey | null {
  const q = LDA_PERIOD[period];
  return q ? (`${year}-Q${q}` as QuarterKey) : null;
}

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
