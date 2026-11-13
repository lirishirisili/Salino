import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LevelPlayInterstitialAd,
  type LevelPlayAdError,
  type LevelPlayAdInfo,
} from 'unity-levelplay-mediation';
import {
  LEVELPLAY_INTERSTITIAL_AD_UNIT_ID,
  LEVELPLAY_PLACEMENTS,
} from '../config/levelPlay';
import { getAdsConfig, type AdsConfig } from './adsConfig';
import { isFullscreenAdShowing, setFullscreenAdShowing, subscribeFullscreenAd } from './fullscreenAdState';
import { isLevelPlayReady } from './initLevelPlay';
import { logAdEvent } from './initMobileAnalytics';
import { isPremiumNow } from './premium';

/**
 * Interstitials at natural completion moments (trip end, a pasted / photo /
 * smart list added, a trip home created). One shared set of user caps covers
 * every placement; the numbers come from `appConfig/ads` (adsConfig.ts).
 * Mirror them as capping / pacing per placement in the LevelPlay dashboard.
 */

export { subscribeFullscreenAd };

const LOG = '[INTERSTITIAL]';

// Lifecycle callbacks use console.warn so they appear in release logcat.
const log = (...args: unknown[]) => {
  console.warn(...args);
};

const STORAGE_KEY = '@ads_interstitial_v1';
const DAY_MS = 24 * 60 * 60 * 1000;

/** Only after a real trip: something bought and the screen open at least this long. */
const MIN_TRIP_DURATION_MS = 60_000;
/** If the ad never reports display, continue the flow anyway. */
const DISPLAY_TIMEOUT_MS = 4_000;

export type InterstitialPlacement =
  | typeof LEVELPLAY_PLACEMENTS.tripEndInterstitial
  | typeof LEVELPLAY_PLACEMENTS.pasteDoneInterstitial
  | typeof LEVELPLAY_PLACEMENTS.tripHomeCreatedInterstitial
  | typeof LEVELPLAY_PLACEMENTS.aiGateInterstitial;

export type InterstitialStats = {
  firstSeenAt: number;
  tripsCompleted: number;
  lastShownAt: number;
  /** Show times within the last 24h (for maxPerDay). */
  recentShows?: number[];
};

let stats: InterstitialStats | null = null;
let ad: LevelPlayInterstitialAd | null = null;
let loading = false;
let loadStartedAt = 0;
let loaded = false;
let displayed = false;
let pendingDone: (() => void) | null = null;
/**
 * Once a feature gate needs ads, keep one interstitial loaded for the session:
 * reload after every show and retry failed loads (Tohav's FullscreenSlot).
 */
let keepWarm = false;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/** Back-off between failed loads (no fill), reset on a successful load. */
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 300_000];
/** A load the SDK never answered stops blocking new loads after this long. */
const LOAD_STALE_MS = 45_000;

function isLoading(): boolean {
  return loading && Date.now() - loadStartedAt < LOAD_STALE_MS;
}

function startLoad(reason: string): void {
  if (!LEVELPLAY_INTERSTITIAL_AD_UNIT_ID || !isLevelPlayReady()) return;
  if (isLoading() || loaded || pendingDone) return;
  loading = true;
  loadStartedAt = Date.now();
  log(`${LOG} load requested (${reason})`);
  getAd()
    .loadAd()
    .catch((err) => {
      loading = false;
      log(`${LOG} loadAd threw`, err);
      scheduleRetry();
    });
}

function scheduleRetry(): void {
  if (!keepWarm || retryTimer) return;
  const delay = RETRY_DELAYS_MS[Math.min(retry, RETRY_DELAYS_MS.length - 1)];
  retry += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    startLoad('retry');
  }, delay);
}

async function getStats(): Promise<InterstitialStats> {
  if (stats) return stats;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      stats = JSON.parse(raw) as InterstitialStats;
      return stats;
    }
  } catch {
    // Fall through to fresh stats.
  }
  stats = { firstSeenAt: Date.now(), tripsCompleted: 0, lastShownAt: 0, recentShows: [] };
  await saveStats();
  return stats;
}

async function saveStats(): Promise<void> {
  if (!stats) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Best-effort; caps reset at worst.
  }
}

/**
 * QA builds only: `EXPO_PUBLIC_ADS_IGNORE_CAPS=1` at bundle time skips the user-level caps
 * so the interstitial can be checked on the first trip. Never set for store builds.
 */
const IGNORE_USER_CAPS = process.env.EXPO_PUBLIC_ADS_IGNORE_CAPS === '1';

export type CapBlock = 'grace' | 'trips' | 'interval' | 'daily' | null;

/** Pure cap check (exported for tests). Returns the first cap that blocks, or null. */
export function userCapBlock(
  s: InterstitialStats,
  now: number,
  cfg: AdsConfig['interstitial'],
): CapBlock {
  if (now - s.firstSeenAt < cfg.gracePeriodMs) return 'grace';
  if (s.tripsCompleted < cfg.minCompletedTrips) return 'trips';
  if (now - s.lastShownAt < cfg.minIntervalMs) return 'interval';
  const today = (s.recentShows ?? []).filter((t) => now - t < DAY_MS).length;
  if (today >= cfg.maxPerDay) return 'daily';
  return null;
}

function blockedFor(placement: InterstitialPlacement, s: InterstitialStats, now: number): string | null {
  const cfg = getAdsConfig();
  if (isPremiumNow()) return 'premium';
  if (!cfg.adsEnabled) return 'disabled';
  if (cfg.interstitial.placements[placement] === false) return 'placement_off';
  if (IGNORE_USER_CAPS) return null;
  return userCapBlock(s, now, cfg.interstitial);
}

function finish() {
  const done = pendingDone;
  pendingDone = null;
  loaded = false;
  setFullscreenAdShowing(false);
  done?.();
  // Have the next one ready for the next gated use.
  if (keepWarm) setTimeout(() => startLoad('after_show'), 1_000);
}

function getAd(): LevelPlayInterstitialAd {
  if (ad) return ad;
  ad = new LevelPlayInterstitialAd(LEVELPLAY_INTERSTITIAL_AD_UNIT_ID);
  ad.setListener({
    onAdLoaded: (adInfo: LevelPlayAdInfo) => {
      loading = false;
      loaded = true;
      retry = 0;
      log(`${LOG} onAdLoaded network=${adInfo.adNetwork}`);
    },
    onAdLoadFailed: (error: LevelPlayAdError) => {
      loading = false;
      loaded = false;
      log(`${LOG} onAdLoadFailed code=${error.errorCode} message=${error.errorMessage}`);
      scheduleRetry();
    },
    onAdDisplayed: (adInfo: LevelPlayAdInfo) => {
      displayed = true;
      log(`${LOG} onAdDisplayed network=${adInfo.adNetwork}`);
    },
    onAdDisplayFailed: (error: LevelPlayAdError) => {
      log(`${LOG} onAdDisplayFailed code=${error.errorCode} message=${error.errorMessage}`);
      loaded = false;
      finish();
    },
    onAdClosed: () => {
      log(`${LOG} onAdClosed`);
      loaded = false;
      finish();
    },
  });
  return ad;
}

/** Start the grace-period clock; call once the user reaches the main list. */
export async function registerInterstitialUser(): Promise<void> {
  await getStats();
}

/**
 * Preload ahead of a likely completion moment, only when an ad could actually be
 * shown there (avoids wasted requests that hurt show rate).
 */
export async function preloadInterstitial(
  placement: InterstitialPlacement = LEVELPLAY_PLACEMENTS.tripEndInterstitial,
): Promise<void> {
  if (!LEVELPLAY_INTERSTITIAL_AD_UNIT_ID || !isLevelPlayReady()) return;
  if (isLoading() || loaded) return;
  const s = await getStats();
  if (blockedFor(placement, s, Date.now())) return;
  startLoad(placement);
}

/** Back-compat name used by supermarket mode. */
export const preloadTripEndInterstitial = () => preloadInterstitial(LEVELPLAY_PLACEMENTS.tripEndInterstitial);

/**
 * Shows an interstitial at `placement` only if every cap passes and an ad is
 * already loaded — never waits for a load. `onDone` always runs exactly once
 * (after close, or immediately).
 */
export async function maybeShowInterstitial(
  placement: InterstitialPlacement,
  onDone: () => void,
): Promise<void> {
  const now = Date.now();
  let s: InterstitialStats;
  try {
    s = await getStats();
  } catch {
    onDone();
    return;
  }

  let reason: string | null = blockedFor(placement, s, now);
  if (!reason && isFullscreenAdShowing()) reason = 'busy';
  if (!reason && (!LEVELPLAY_INTERSTITIAL_AD_UNIT_ID || !isLevelPlayReady())) reason = 'sdk';
  if (!reason && !loaded) reason = 'not_loaded';
  if (!reason) {
    try {
      const placementCapped = await LevelPlayInterstitialAd.isPlacementCapped(placement);
      if (placementCapped) reason = 'dashboard_cap';
      else if (!(await getAd().isAdReady())) reason = 'not_ready';
    } catch {
      reason = 'error';
    }
  }

  if (reason) {
    await saveStats();
    // Grace / premium skips are expected and frequent; only log the actionable ones.
    if (reason !== 'premium' && reason !== 'grace') {
      logAdEvent('ad_interstitial_skip', { placement, reason });
    }
    onDone();
    return;
  }

  s.lastShownAt = now;
  s.recentShows = [...(s.recentShows ?? []).filter((t) => now - t < DAY_MS), now];
  await saveStats();
  present(placement, onDone);
}

/** Shows the loaded interstitial; `onDone` runs once after close / failure / timeout. */
function present(placement: InterstitialPlacement, onDone: () => void): void {
  pendingDone = onDone;
  setFullscreenAdShowing(true);
  log(`${LOG} show placement=${placement}`);
  logAdEvent('ad_interstitial_show', { placement });
  displayed = false;
  setTimeout(() => {
    // Safety net: if the SDK neither displayed nor failed, don't strand the user.
    if (pendingDone === onDone && !displayed) {
      log(`${LOG} display timeout — continuing`);
      finish();
    }
  }, DISPLAY_TIMEOUT_MS);
  getAd()
    .showAd(placement)
    .catch((err) => {
      log(`${LOG} showAd threw`, err);
      finish();
    });
}

export function isInterstitialLoaded(): boolean {
  return loaded && !!LEVELPLAY_INTERSTITIAL_AD_UNIT_ID && isLevelPlayReady();
}

function gateBlocked(): boolean {
  const cfg = getAdsConfig();
  return isPremiumNow() || !cfg.adsEnabled || cfg.interstitial.placements[LEVELPLAY_PLACEMENTS.aiGateInterstitial] === false;
}

/** Loads an interstitial for a feature gate — not held back by the user caps. */
export function preloadGateInterstitial(): void {
  if (gateBlocked()) return;
  keepWarm = true;
  startLoad('gate');
}

/**
 * Plays an interstitial at a feature gate once the free uses are gone (same as
 * Tohav's AI gate). Ignores the grace period and the daily cap of "done moment"
 * ads; resolves false when nothing was shown (none loaded, ads off, premium).
 */
export async function showGateInterstitial(): Promise<boolean> {
  const placement = LEVELPLAY_PLACEMENTS.aiGateInterstitial;
  const skip = (reason: string) => {
    log(`${LOG} gate skip reason=${reason} loaded=${loaded} loading=${loading}`);
    logAdEvent('ad_interstitial_skip', { placement, reason });
    return false;
  };
  if (gateBlocked()) return skip('blocked');
  if (isFullscreenAdShowing()) return skip('fullscreen_busy');
  if (!isInterstitialLoaded()) return skip('not_loaded');
  try {
    if (!(await getAd().isAdReady())) {
      // The SDK no longer has a usable ad (expired / consumed): reload for next time.
      loaded = false;
      startLoad('not_ready');
      return skip('sdk_not_ready');
    }
  } catch (e) {
    loaded = false;
    startLoad('ready_check_error');
    return skip(`ready_check_error:${String(e).slice(0, 60)}`);
  }
  // Keeps a "done moment" interstitial from following right after this one.
  try {
    const s = await getStats();
    s.lastShownAt = Date.now();
    await saveStats();
  } catch {
    // Best-effort.
  }
  await new Promise<void>((resolve) => present(placement, resolve));
  return true;
}

type TripEndContext = {
  boughtCount: number;
  tripStartedAt: number;
};

/** Called when a supermarket trip ends: counts a real trip, then maybe shows `trip_end`. */
export async function maybeShowTripEndInterstitial(
  { boughtCount, tripStartedAt }: TripEndContext,
  onDone: () => void,
): Promise<void> {
  const realTrip = boughtCount > 0 && Date.now() - tripStartedAt >= MIN_TRIP_DURATION_MS;
  if (!realTrip) {
    onDone();
    return;
  }
  try {
    const s = await getStats();
    s.tripsCompleted += 1;
  } catch {
    // Counting is best-effort.
  }
  await maybeShowInterstitial(LEVELPLAY_PLACEMENTS.tripEndInterstitial, onDone);
}
