import Constants from 'expo-constants';
import { PermissionStatus } from 'expo-modules-core';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { AppState, AppStateStatus, Platform } from 'react-native';
import Appodeal, {
  AppodealAdType,
  AppodealBannerEvents,
  AppodealInterstitialEvents,
  AppodealLogLevel,
  AppodealRewardedEvents,
  AppodealSdkEvents,
} from 'react-native-appodeal';
import { setMetaAdvertiserTrackingEnabled } from '../../modules/meta-att-bridge';
import {
  APPODEAL_APP_KEY,
  APPODEAL_ENABLE_TEST_MODE,
} from '../config/appodeal';
import { isNativeDebuggableBuild } from '../utils/isNativeDebuggableBuild';

const LOG = '[APPODEAL]';

const log = (...args: unknown[]) => {
  console.warn(...args);
};

const ATT_ACTIVE_WAIT_MS = 10_000;
const ATT_PROMPT_DELAY_MS = 1500;
/** Fallback if onAppodealInitialized never fires (should be rare). */
const INIT_TIMEOUT_MS = 12_000;

/** Debug/test onboarding: Banner + Interstitial + Rewarded (no auto-show). */
const TEST_AD_TYPES =
  AppodealAdType.BANNER |
  AppodealAdType.INTERSTITIAL |
  AppodealAdType.REWARDED_VIDEO;

type Status = 'idle' | 'initializing' | 'ready' | 'failed' | 'skipped';

let status: Status = 'idle';
let initPromise: Promise<boolean> | null = null;
const readySubscribers = new Set<(ready: boolean) => void>();
let adListenersRegistered = false;

export function isAppodealReady(): boolean {
  return status === 'ready';
}

export function subscribeAppodealReady(cb: (ready: boolean) => void): () => void {
  readySubscribers.add(cb);
  if (status === 'ready') cb(true);
  else if (status === 'failed' || status === 'skipped') cb(false);
  return () => {
    readySubscribers.delete(cb);
  };
}

function notifyReady(ready: boolean) {
  readySubscribers.forEach((cb) => {
    try {
      cb(ready);
    } catch {
      // Ignore subscriber errors.
    }
  });
}

function waitForActiveState(): Promise<void> {
  return new Promise((resolve) => {
    if (AppState.currentState === 'active') {
      resolve();
      return;
    }
    const timeout = setTimeout(() => {
      subscription.remove();
      resolve();
    }, ATT_ACTIVE_WAIT_MS);
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        clearTimeout(timeout);
        subscription.remove();
        resolve();
      }
    });
  });
}

function isTrackingAuthorized(status: PermissionStatus): boolean {
  return status === PermissionStatus.GRANTED;
}

async function ensureIosPrivacyBeforeInit(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }
  try {
    await waitForActiveState();
    await new Promise((r) => setTimeout(r, ATT_PROMPT_DELAY_MS));
    let { status: attStatus } = await getTrackingPermissionsAsync();
    if (attStatus === PermissionStatus.UNDETERMINED) {
      ({ status: attStatus } = await requestTrackingPermissionsAsync());
    }
    const trackingEnabled = isTrackingAuthorized(attStatus);
    log(
      `${LOG} iOS ATT status=${attStatus} metaAdvertiserTrackingEnabled=${trackingEnabled}`,
    );
    await setMetaAdvertiserTrackingEnabled(trackingEnabled);
  } catch (err) {
    console.warn(`${LOG} App Tracking Transparency / Meta tracking setup failed:`, err);
    await setMetaAdvertiserTrackingEnabled(false);
  }
}

function registerAdListeners() {
  if (adListenersRegistered) return;
  adListenersRegistered = true;

  Appodeal.addEventListener(AppodealBannerEvents.LOADED, () => {
    log('[BANNER] loaded');
  });
  Appodeal.addEventListener(AppodealBannerEvents.FAILED_TO_LOAD, () => {
    console.warn('[BANNER] failed to load');
  });
  Appodeal.addEventListener(AppodealBannerEvents.SHOWN, () => {
    log('[BANNER] shown');
    log('[BANNER] Banner [Notify Shown]');
  });
  Appodeal.addEventListener(AppodealBannerEvents.CLICKED, () => {
    log('[BANNER] clicked');
  });
  Appodeal.addEventListener(AppodealBannerEvents.EXPIRED, () => {
    log('[BANNER] expired');
  });

  // Interstitial / Rewarded: lifecycle logging. Never auto-shown — DEBUG panel only.
  Appodeal.addEventListener(AppodealInterstitialEvents.LOADED, () => {
    log('[INTERSTITIAL] loaded');
  });
  Appodeal.addEventListener(AppodealInterstitialEvents.FAILED_TO_LOAD, () => {
    console.warn('[INTERSTITIAL] failed to load');
  });
  Appodeal.addEventListener(AppodealInterstitialEvents.SHOWN, () => {
    log('[INTERSTITIAL] shown');
  });
  Appodeal.addEventListener(AppodealInterstitialEvents.FAILED_TO_SHOW, () => {
    console.warn('[INTERSTITIAL] show failed');
  });
  Appodeal.addEventListener(AppodealInterstitialEvents.CLICKED, () => {
    log('[INTERSTITIAL] clicked');
  });
  Appodeal.addEventListener(AppodealInterstitialEvents.CLOSED, () => {
    log('[INTERSTITIAL] closed');
  });
  Appodeal.addEventListener(AppodealInterstitialEvents.EXPIRED, () => {
    log('[INTERSTITIAL] expired');
  });

  Appodeal.addEventListener(AppodealRewardedEvents.LOADED, () => {
    log('[REWARDED] loaded');
  });
  Appodeal.addEventListener(AppodealRewardedEvents.FAILED_TO_LOAD, () => {
    console.warn('[REWARDED] failed to load');
  });
  Appodeal.addEventListener(AppodealRewardedEvents.SHOWN, () => {
    log('[REWARDED] shown');
  });
  Appodeal.addEventListener(AppodealRewardedEvents.FAILED_TO_SHOW, () => {
    console.warn('[REWARDED] show failed');
  });
  Appodeal.addEventListener(AppodealRewardedEvents.CLOSED, () => {
    log('[REWARDED] closed');
  });
  Appodeal.addEventListener(AppodealRewardedEvents.REWARD, (reward) => {
    log('[REWARDED] finished', reward);
  });
  Appodeal.addEventListener(AppodealRewardedEvents.CLICKED, () => {
    log('[REWARDED] clicked');
  });
  Appodeal.addEventListener(AppodealRewardedEvents.EXPIRED, () => {
    log('[REWARDED] expired');
  });
}

/**
 * DEBUG-only: show interstitial after isLoaded check. Never called from production UI.
 * @returns whether show() was invoked
 */
export function showDebugInterstitial(): boolean {
  if (!isNativeDebuggableBuild()) {
    console.warn('[INTERSTITIAL] show blocked — not a native DEBUG build');
    return false;
  }
  const adType = AppodealAdType.INTERSTITIAL;
  const loaded = Appodeal.isLoaded(adType);
  const can = Appodeal.canShow(adType);
  log(`[INTERSTITIAL] isLoaded=${loaded} canShow=${can}`);
  if (!loaded) {
    log('[INTERSTITIAL] show skipped — not loaded');
    return false;
  }
  try {
    Appodeal.show(adType);
    log(`[INTERSTITIAL] show() invoked (canShow=${can})`);
    return true;
  } catch (err) {
    console.warn('[INTERSTITIAL] show failed', err);
    return false;
  }
}

/**
 * DEBUG-only: show rewarded after isLoaded check. Only via explicit DEBUG button tap.
 * @returns whether show() was invoked
 */
export function showDebugRewarded(): boolean {
  if (!isNativeDebuggableBuild()) {
    console.warn('[REWARDED] show blocked — not a native DEBUG build');
    return false;
  }
  const adType = AppodealAdType.REWARDED_VIDEO;
  const loaded = Appodeal.isLoaded(adType);
  const can = Appodeal.canShow(adType);
  log(`[REWARDED] isLoaded=${loaded} canShow=${can}`);
  if (!loaded) {
    log('[REWARDED] show skipped — not loaded');
    return false;
  }
  try {
    Appodeal.show(adType);
    log(`[REWARDED] show() invoked (canShow=${can})`);
    return true;
  } catch (err) {
    console.warn('[REWARDED] show failed', err);
    return false;
  }
}

/** DEBUG helper: current load flags for the test panel. */
export function getDebugAdLoadState(): {
  ready: boolean;
  interstitialLoaded: boolean;
  rewardedLoaded: boolean;
} {
  let interstitialLoaded = false;
  let rewardedLoaded = false;
  try {
    interstitialLoaded = Appodeal.isLoaded(AppodealAdType.INTERSTITIAL);
    rewardedLoaded = Appodeal.isLoaded(AppodealAdType.REWARDED_VIDEO);
  } catch {
    // Native module may be unavailable.
  }
  return {
    ready: status === 'ready',
    interstitialLoaded,
    rewardedLoaded,
  };
}

/**
 * Initialize Appodeal once per session.
 * Debug/test: BANNER | INTERSTITIAL | REWARDED_VIDEO (no auto-show of fullscreen ads).
 * Production (test mode off): BANNER only.
 * Stack Consent Manager runs automatically on initialize (no AdMob App ID).
 */
export function initAppodeal(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(false);
  }
  if (Constants.appOwnership === 'expo') {
    console.warn(`${LOG} init skipped (Expo Go — native module unavailable)`);
    return Promise.resolve(false);
  }
  if (!APPODEAL_APP_KEY) {
    status = 'skipped';
    console.warn(`${LOG} init skipped — no Appodeal app key for ${Platform.OS}`);
    notifyReady(false);
    return Promise.resolve(false);
  }
  if (initPromise) {
    return initPromise;
  }

  status = 'initializing';
  initPromise = new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (ready: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ready);
    };

    void (async () => {
      log(`${LOG} init started`);
      log(`${LOG} platform ${Platform.OS} appKey=${APPODEAL_APP_KEY}`);

      registerAdListeners();

      // Verbose while verifying ads (test mode) or in dev builds.
      if (__DEV__ || APPODEAL_ENABLE_TEST_MODE) {
        Appodeal.setLogLevel(AppodealLogLevel.VERBOSE);
        log(`${LOG} verbose SDK logging enabled`);
      }

      if (APPODEAL_ENABLE_TEST_MODE) {
        Appodeal.setTesting(true);
        console.warn(
          `${LOG} TEST MODE ENABLED — set APPODEAL_ENABLE_TEST_MODE=false for production`,
        );
      }

      Appodeal.setTabletBanners(false);

      await ensureIosPrivacyBeforeInit();

      const markReady = (source: string) => {
        if (status === 'ready') {
          settle(true);
          return;
        }
        status = 'ready';
        log(`${LOG} ready via ${source}`);
        notifyReady(true);
        settle(true);
      };

      const markFailed = (err: unknown) => {
        status = 'failed';
        console.warn(`${LOG} init failed (exception)`, err);
        initPromise = null;
        notifyReady(false);
        settle(false);
      };

      try {
        // Mount banner only after SDK reports initialized — avoids first-frame
        // crashes when AppodealBanner attaches before native init finishes.
        Appodeal.addEventListener(AppodealSdkEvents.INITIALIZED, () => {
          log(`${LOG} onAppodealInitialized`);
          try {
            Appodeal.hide(AppodealAdType.BANNER_BOTTOM);
            Appodeal.hide(AppodealAdType.BANNER_TOP);
          } catch {
            // ignore
          }
          markReady('INITIALIZED');
        });

        // Consent/CMP is handled automatically by Stack Consent Manager on initialize.
        // Test build: register Interstitial + Rewarded for Appodeal onboarding.
        // Do NOT call Appodeal.show for those types — banner UI stays unchanged.
        const adTypes = APPODEAL_ENABLE_TEST_MODE
          ? TEST_AD_TYPES
          : AppodealAdType.BANNER;
        Appodeal.initialize(APPODEAL_APP_KEY, adTypes);
        log(
          `${LOG} initialize called (adTypes=${adTypes}` +
            `${APPODEAL_ENABLE_TEST_MODE ? ' BANNER|INTERSTITIAL|REWARDED' : ' BANNER only'}); ` +
            `waiting for INITIALIZED`,
        );
      } catch (err) {
        markFailed(err);
        return;
      }

      setTimeout(() => {
        if (!settled) {
          console.warn(
            `${LOG} INITIALIZED not received within ${INIT_TIMEOUT_MS}ms — proceeding anyway`,
          );
          markReady('timeout');
        }
      }, INIT_TIMEOUT_MS);
    })();
  });

  return initPromise;
}
