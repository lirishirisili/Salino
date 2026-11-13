import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAdsConfig, loadAdsConfig, type RewardedFeature } from './adsConfig';
import { logAdEvent } from './initMobileAnalytics';
import { isPremiumNow } from './premium';
import { isInterstitialLoaded, preloadGateInterstitial, showGateInterstitial } from './interstitialAd';
import { subscribeLevelPlayReady } from './initLevelPlay';

/**
 * Daily free uses per feature; after that every use plays an interstitial right
 * away — no "watch an ad?" dialog first (Tohav's AI-gate pattern). Rewarded video
 * isn't used here: networks require rewarded ads to be opted into, which a
 * no-dialog flow can't offer. Premium users, and users we have no ad for, always
 * pass — an empty ad inventory must never lock anyone out of a feature.
 */

const STORAGE_KEY = '@feature_uses_v1';
const FEATURES: RewardedFeature[] = ['photo_list', 'smart_list', 'forgotten_items', 'insights'];

type UsesByDay = { day: string; uses: Partial<Record<RewardedFeature, number>> };

/** Local calendar day, e.g. "2026-11-13". */
export function dayKey(now: Date = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

let cache: UsesByDay | null = null;

async function readUses(): Promise<UsesByDay> {
  const today = dayKey();
  if (cache && cache.day === today) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as UsesByDay) : null;
    cache = parsed && parsed.day === today ? parsed : { day: today, uses: {} };
  } catch {
    cache = { day: today, uses: {} };
  }
  return cache;
}

async function recordUse(feature: RewardedFeature): Promise<void> {
  const u = await readUses();
  u.uses[feature] = (u.uses[feature] ?? 0) + 1;
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u)).catch(() => undefined);
}

/** Free uses left today (Infinity for premium users). */
export async function freeUsesLeft(feature: RewardedFeature): Promise<number> {
  if (isPremiumNow()) return Infinity;
  await loadAdsConfig();
  const u = await readUses();
  return Math.max(0, getAdsConfig().rewarded.freePerDay[feature] - (u.uses[feature] ?? 0));
}

/**
 * Call right before a gated feature runs. Free uses go straight through; past
 * them an interstitial plays first (when one is loaded). Always resolves true —
 * the boolean leaves room for a gate that can be declined.
 */
export async function requestFeatureUse(feature: RewardedFeature): Promise<boolean> {
  logAdEvent('feature_used', { feature });
  if (isPremiumNow()) return true;
  const left = await freeUsesLeft(feature);
  console.warn(`[GATE] ${feature} freeLeft=${left} adLoaded=${isInterstitialLoaded()}`);
  if (left > 0) {
    await recordUse(feature);
    logAdEvent('rewarded_free_use', { feature });
    // That was the last free one: have an ad ready for the next use.
    if (left === 1) warmGateAds();
    return true;
  }

  if (isInterstitialLoaded()) {
    await showGateInterstitial();
  } else {
    // No fill: let the user through and try to have one next time.
    logAdEvent('ad_interstitial_skip', { placement: 'ai_gate', reason: 'not_loaded', feature });
  }
  await recordUse(feature);
  warmGateAds();
  return true;
}

// After a restart with a feature already used up today, get a gate ad ready.
subscribeLevelPlayReady((ready) => {
  if (!ready) return;
  void (async () => {
    for (const f of FEATURES) {
      if ((await freeUsesLeft(f)) === 0) {
        warmGateAds();
        return;
      }
    }
  })();
});

/** Preloads the gate interstitial (no-op when one is loaded / loading). */
export function warmGateAds(): void {
  if (isPremiumNow()) return;
  preloadGateInterstitial();
}
