import { Agent, fetch, type RequestInit, type Response } from "undici";

const UA = "Mozilla/5.0 (compatible; HaserliPrices/1.0; +https://hsr.lirshir.com)";

/** publishedprices.co.il serves an incomplete certificate chain; the data is public and integrity-checked by parsing. */
const lenientTls = new Agent({ connect: { rejectUnauthorized: false }, headersTimeout: 60_000, bodyTimeout: 120_000 });
const strictTls = new Agent({ headersTimeout: 60_000, bodyTimeout: 120_000 });

export interface HttpOptions extends Omit<RequestInit, "dispatcher"> {
  lenientTls?: boolean;
  timeoutMs?: number;
  retries?: number;
}

export async function request(url: string, opts: HttpOptions = {}): Promise<Response> {
  const { lenientTls: lenient, timeoutMs = 90_000, retries = 3, headers, ...init } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "User-Agent": UA, ...(headers as Record<string, string> | undefined) },
        dispatcher: lenient ? lenientTls : strictTls,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status >= 500 || res.status === 429) {
        await res.body?.cancel();
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function getText(url: string, opts: HttpOptions = {}): Promise<string> {
  const res = await request(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export async function getBuffer(url: string, opts: HttpOptions = {}): Promise<Buffer> {
  const res = await request(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class CookieJar {
  private readonly jar = new Map<string, string>();

  absorb(res: Response): void {
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const eq = kv.indexOf("=");
      if (eq > 0) this.jar.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim());
    }
  }

  header(): string {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

/** Runs `fn` over `items` with at most `limit` in flight; failures are collected, not thrown. */
export async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<{ results: R[]; errors: { item: T; error: unknown }[] }> {
  const results: R[] = [];
  const errors: { item: T; error: unknown }[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        results.push(await fn(item));
      } catch (error) {
        errors.push({ item, error });
      }
    }
  });
  await Promise.all(workers);
  return { results, errors };
}
