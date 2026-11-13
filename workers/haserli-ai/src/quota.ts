/**
 * Daily per-user cap on the costlier routes (vision / generation), so a client
 * that skips the app's rewarded-ad gate still can't run up the AI bill.
 * Backed by an optional KV namespace bound as `QUOTA`; without the binding the
 * cap is off (the per-minute rate limiter still applies). KV is eventually
 * consistent, so the cap is approximate — fine for cost protection.
 */

export type QuotaKind = 'parse_image' | 'generate_list';

export const DAILY_LIMITS: Record<QuotaKind, number> = {
  parse_image: 25,
  generate_list: 25,
};

interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

function quotaKv(env: Env): KvLike | null {
  const kv: unknown = Reflect.get(env, 'QUOTA');
  return kv && typeof (kv as KvLike).get === 'function' ? (kv as KvLike) : null;
}

/** UTC day, e.g. "2026-11-13". */
export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Counts one use; resolves false when the user already hit today's cap. Never throws. */
export async function checkDailyQuota(env: Env, uid: string, kind: QuotaKind): Promise<boolean> {
  const kv = quotaKv(env);
  if (!kv) return true;
  const key = `q:${kind}:${utcDay()}:${uid}`;
  try {
    const used = Number((await kv.get(key)) ?? 0) || 0;
    if (used >= DAILY_LIMITS[kind]) {
      console.log(JSON.stringify({ event: 'daily_quota', kind, used }));
      return false;
    }
    await kv.put(key, String(used + 1), { expirationTtl: 2 * 24 * 60 * 60 });
    return true;
  } catch {
    return true;
  }
}
