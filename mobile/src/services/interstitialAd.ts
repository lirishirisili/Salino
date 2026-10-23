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
import { isLevelPlayReady } from './initLevelPlay';

/**
 * Single trip-end interstitial: the only full-screen ad in the app, shown when
 * a supermarket trip ends. Client-side caps below protect UX; mirror them as
 * capping / pacing on the `trip_end` placement in the LevelPlay dashboard.
 */

const LOG = '[INTERSTITIAL]';

// Lifecycle callbacks use console.warn so they appear in release logcat.
const log = (...args: unknown[]) => {
  console.warn(...args);
};

const STORAGE_KEY = '@ads_interstitial_v1';
const DAY_MS = 24 * 60 * 60 * 1000;

/** No interstitials during the first days after the user first reached the list. */
const GRACE_PERIOD_MS = 3 * DAY_MS;
/** Trips completed before the first interstitial may appear. */
const MIN_COMPLETED_TRIPS = 2;
/** At most one interstitial per this window. */
const MIN_INTERVAL_MS = DAY_MS;
/** Only after a real trip: something bought and the screen open at least this long. */
const MIN_TRIP_DURATION_MS = 60_000;
/** If the ad never reports display, continue the flow anyway. */
const DISPLAY_TIMEOUT_MS = 4_000;

type InterstitialStats = {
  firstSeenAt: number;
  tripsCompleted: number;
  lastShownAt: number;
};

let stats: InterstitialStats | null = null;
let ad: LevelPlayInterstitialAd | null = null;
let loading = false;
let loaded = false;
let showing = false;
let displayed = false;
let pendingDone: (() => void) | null = null;
const fullscreenSubscribers = new Set<(showing: boolean) => void>();

/** Notified while a full-screen ad covers the app (the banner pauses refresh). */
export function subscribeFullscreenAd(cb: (showing: boolean) => void): () => void {
  fullscreenSubscribers.add(cb);
  return () => {
    fullscreenSubscribers.delete(cb);
  };
}

function setShowing(next: boolean) {
  showing = next;
  fullscreenSubscribers.forEach((cb) => {
    try {
      cb(next);
    } catch {
      // Ignore subscriber errors.
    }
  });
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
  stats = { firstSeenAt: Date.now(), tripsCompleted: 0, lastShownAt: 0 };
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

/** User-level caps (grace period, trip count, 24h interval). */
function passesUserCaps(s: InterstitialStats, now: number): boolean {
  if (IGNORE_USER_CAPS) return true;
  return (
    now - s.firstSeenAt >= GRACE_PERIOD_MS &&
    s.tripsCompleted >= MIN_COMPLETED_TRIPS &&
    now - s.lastShownAt >= MIN_INTERVAL_MS
  );
}

function finish() {
  const done = pendingDone;
  pendingDone = null;
  setShowing(false);
  done?.();
}

function getAd(): LevelPlayInterstitialAd {
  if (ad) return ad;
  ad = new LevelPlayInterstitialAd(LEVELPLAY_INTERSTITIAL_AD_UNIT_ID);
  ad.setListener({
    onAdLoaded: (adInfo: LevelPlayAdInfo) => {
      loading = false;
      loaded = true;
      log(`${LOG} onAdLoaded network=${adInfo.adNetwork}`);
    },
    onAdLoadFailed: (error: LevelPlayAdError) => {
      loading = false;
      loaded = false;
      log(`${LOG} onAdLoadFailed code=${error.errorCode} message=${error.errorMessage}`);
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
 * Preload while the user shops, only when an ad could actually be shown at the
 * end of this trip (avoids wasted requests that hurt show rate).
 */
export async function preloadTripEndInterstitial(): Promise<void> {
  if (!LEVELPLAY_INTERSTITIAL_AD_UNIT_ID || !isLevelPlayReady()) return;
  if (loading || loaded) return;
  const s = await getStats();
  if (!passesUserCaps(s, Date.now())) return;
  loading = true;
  log(`${LOG} load requested`);
  getAd()
    .loadAd()
    .catch((err) => {
      loading = false;
      log(`${LOG} loadAd threw`, err);
    });
}

type TripEndContext = {
  boughtCount: number;
  tripStartedAt: number;
};

/**
 * Called when a supermarket trip ends. Counts the trip, and shows the
 * interstitial only if every cap passes and an ad is already loaded — never
 * waits for a load. `onDone` always runs exactly once (after close, or now).
 */
export async function maybeShowTripEndInterstitial(
  { boughtCount, tripStartedAt }: TripEndContext,
  onDone: () => void,
): Promise<void> {
  const now = Date.now();
  const realTrip = boughtCount > 0 && now - tripStartedAt >= MIN_TRIP_DURATION_MS;
  let s: InterstitialStats;
  try {
    s = await getStats();
  } catch {
    onDone();
    return;
  }

  const eligible =
    realTrip &&
    !showing &&
    !!LEVELPLAY_INTERSTITIAL_AD_UNIT_ID &&
    isLevelPlayReady() &&
    loaded &&
    passesUserCaps(s, now);

  if (realTrip) {
    s.tripsCompleted += 1;
  }

  let ready = false;
  if (eligible) {
    try {
      const placementCapped = await LevelPlayInterstitialAd.isPlacementCapped(
        LEVELPLAY_PLACEMENTS.tripEndInterstitial,
      );
      ready = !placementCapped && (await getAd().isAdReady());
    } catch {
      ready = false;
    }
  }

  if (!ready) {
    await saveStats();
    onDone();
    return;
  }

  s.lastShownAt = now;
  await saveStats();
  pendingDone = onDone;
  setShowing(true);
  log(`${LOG} show placement=${LEVELPLAY_PLACEMENTS.tripEndInterstitial}`);
  displayed = false;
  setTimeout(() => {
    // Safety net: if the SDK neither displayed nor failed, don't strand the user.
    if (pendingDone === onDone && !displayed) {
      log(`${LOG} display timeout — continuing`);
      finish();
    }
  }, DISPLAY_TIMEOUT_MS);
  getAd()
    .showAd(LEVELPLAY_PLACEMENTS.tripEndInterstitial)
    .catch((err) => {
      log(`${LOG} showAd threw`, err);
      finish();
    });
}
