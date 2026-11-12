// Shared HTTP helper for data scripts.
// Every successful call returns the exact URL fetched and an ISO retrieved_at
// timestamp so downstream code can store source_url + retrieved_at with each fact.

try {
  // Loads .env.local if present (Node >= 20.12). Never required.
  process.loadEnvFile?.(".env.local");
} catch {
  /* no .env.local — fine */
}

export interface Fetched<T> {
  url: string; // the URL actually requested (API keys are never put in the URL)
  retrieved_at: string;
  status: number;
  data: T;
  rateLimit?: { limit?: string; remaining?: string };
}

export interface FetchOpts {
  headers?: Record<string, string>;
  retries?: number;
  timeoutMs?: number;
  minDelayMs?: number; // politeness delay before each request
}

export const stats = { requests: 0, retries: 0, failures: 0 } as Record<string, number>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson<T = any>(url: string, opts: FetchOpts = {}): Promise<Fetched<T>> {
  const { headers = {}, retries = 5, timeoutMs = 90_000, minDelayMs = 0 } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (minDelayMs) await sleep(minDelayMs);
    stats.requests++;
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "money-trail-feasibility/0.1", ...headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < retries) {
        const ra = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2 ** attempt * 2000;
        stats.retries++;
        console.warn(`  ${res.status} on ${shortUrl(url)}; retry ${attempt + 1}/${retries} in ${wait}ms`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}: ${(await res.text()).slice(0, 300)}`);
      const data = (await res.json()) as T;
      return {
        url,
        retrieved_at: new Date().toISOString(),
        status: res.status,
        data,
        rateLimit: {
          limit: res.headers.get("x-ratelimit-limit") ?? undefined,
          remaining: res.headers.get("x-ratelimit-remaining") ?? undefined,
        },
      };
    } catch (e) {
      lastErr = e;
      if (attempt < retries) {
        stats.retries++;
        const wait = 2 ** attempt * 2000;
        console.warn(`  error on ${shortUrl(url)} (${(e as Error).message.slice(0, 80)}); retry in ${wait}ms`);
        await sleep(wait);
      }
    }
  }
  stats.failures++;
  throw lastErr;
}

/** HEAD-style reachability check (uses GET with a Range header; some servers reject HEAD). */
export async function checkUrl(url: string): Promise<{ url: string; status: number; contentType: string | null; retrieved_at: string }> {
  stats.requests++;
  const res = await fetch(url, { headers: { Range: "bytes=0-1023" }, signal: AbortSignal.timeout(60_000) });
  await res.arrayBuffer().catch(() => undefined);
  return { url, status: res.status, contentType: res.headers.get("content-type"), retrieved_at: new Date().toISOString() };
}

export function qs(params: Record<string, string | number | boolean | Array<string | number> | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, String(x)));
    else sp.append(k, String(v));
  }
  return sp.toString();
}

function shortUrl(u: string) {
  return u.length > 110 ? u.slice(0, 110) + "…" : u;
}
