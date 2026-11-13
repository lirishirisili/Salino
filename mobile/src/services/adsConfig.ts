import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../remote/firebase';

/**
 * Remote ad tuning: Firestore doc `appConfig/ads` (read-only for signed-in
 * users, edited in the Firebase console). Loaded once per session, cached in
 * AsyncStorage for the next cold start, and always merged over the in-code
 * defaults below — a missing / partial / unreadable doc never breaks ads.
 */

const CACHE_KEY = '@ads_config_v1';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type RewardedFeature = 'photo_list' | 'smart_list' | 'forgotten_items' | 'insights';

export interface AdsConfig {
  /** Master switch for every ad format (premium users skip ads regardless). */
  adsEnabled: boolean;
  interstitial: {
    /** Per-placement kill switches; a missing placement counts as enabled. */
    placements: Record<string, boolean>;
    gracePeriodMs: number;
    minCompletedTrips: number;
    maxPerDay: number;
    minIntervalMs: number;
  };
  rewarded: {
    enabled: boolean;
    /** Free uses per calendar day before a rewarded ad is asked for. */
    freePerDay: Record<RewardedFeature, number>;
  };
  nativeListEnd: boolean;
  /** Minimum active items before the native ad shows at the end of the list. */
  nativeListMinItems: number;
  mrec: Record<string, boolean>;
}

export const DEFAULT_ADS_CONFIG: AdsConfig = {
  adsEnabled: true,
  interstitial: {
    placements: { trip_end: true, paste_done: true, trip_home_created: true, ai_gate: true },
    gracePeriodMs: 2 * DAY_MS,
    minCompletedTrips: 2,
    maxPerDay: 2,
    minIntervalMs: 6 * HOUR_MS,
  },
  rewarded: {
    enabled: true,
    freePerDay: { photo_list: 1, smart_list: 1, forgotten_items: 1, insights: 1 },
  },
  nativeListEnd: true,
  nativeListMinItems: 3,
  mrec: { all_done: true, history: true, activity: true, smart_result: true, insights: true },
};

let current: AdsConfig = DEFAULT_ADS_CONFIG;
let loadPromise: Promise<AdsConfig> | null = null;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(Math.max(v, min), max) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

function boolMap<K extends string>(raw: unknown, fallback: Record<K, boolean>): Record<K, boolean> {
  const out = { ...fallback } as Record<string, boolean>;
  if (isObj(raw)) {
    for (const [k, v] of Object.entries(raw)) if (typeof v === 'boolean') out[k] = v;
  }
  return out as Record<K, boolean>;
}

/** Merges an untrusted doc over the defaults, clamping every number to a sane range. */
export function mergeAdsConfig(raw: unknown, base: AdsConfig = DEFAULT_ADS_CONFIG): AdsConfig {
  if (!isObj(raw)) return base;
  const i = isObj(raw.interstitial) ? raw.interstitial : {};
  const r = isObj(raw.rewarded) ? raw.rewarded : {};
  const free = isObj(r.freePerDay) ? r.freePerDay : {};
  const freePerDay = { ...base.rewarded.freePerDay };
  (Object.keys(freePerDay) as RewardedFeature[]).forEach((k) => {
    freePerDay[k] = num(free[k], freePerDay[k], 0, 1000);
  });
  return {
    adsEnabled: bool(raw.adsEnabled, base.adsEnabled),
    interstitial: {
      placements: boolMap(i.placements, base.interstitial.placements),
      gracePeriodMs: num(i.gracePeriodMs, base.interstitial.gracePeriodMs, 0, 30 * DAY_MS),
      minCompletedTrips: num(i.minCompletedTrips, base.interstitial.minCompletedTrips, 0, 100),
      maxPerDay: num(i.maxPerDay, base.interstitial.maxPerDay, 0, 10),
      // Never allow interstitials closer than 30 minutes apart, whatever the doc says.
      minIntervalMs: num(i.minIntervalMs, base.interstitial.minIntervalMs, 30 * 60 * 1000, 7 * DAY_MS),
    },
    rewarded: { enabled: bool(r.enabled, base.rewarded.enabled), freePerDay },
    nativeListEnd: bool(raw.nativeListEnd, base.nativeListEnd),
    nativeListMinItems: num(raw.nativeListMinItems, base.nativeListMinItems, 0, 50),
    mrec: boolMap(raw.mrec, base.mrec),
  };
}

/** Current config (defaults until the first load finishes). */
export function getAdsConfig(): AdsConfig {
  return current;
}

/** Loads cache then Firestore once per session. Never throws. */
export function loadAdsConfig(): Promise<AdsConfig> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) current = mergeAdsConfig(JSON.parse(cached));
    } catch {
      // Ignore a corrupt cache.
    }
    try {
      const snap = await getDoc(doc(db, 'appConfig', 'ads'));
      if (snap.exists()) {
        const data = snap.data();
        current = mergeAdsConfig(data);
        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => undefined);
      }
    } catch (e) {
      console.warn('[ADS_CONFIG] load failed, using cached/defaults', e);
    }
    return current;
  })();
  return loadPromise;
}
