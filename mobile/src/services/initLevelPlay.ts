import Constants from 'expo-constants';
import { PermissionStatus } from 'expo-modules-core';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { AppState, AppStateStatus, Platform } from 'react-native';
import {
  LevelPlay,
  LevelPlayInitRequest,
  type LevelPlayConfiguration,
  type LevelPlayInitError,
  type LevelPlayInitListener,
  type LevelPlayImpressionData,
} from 'unity-levelplay-mediation';
import { LEVELPLAY_APP_KEY } from '../config/levelPlay';

const LOG = '[LEVELPLAY]';

// Info-level SDK logs are dev-only; warnings for real failures are kept.
const log = (...args: unknown[]) => {
  if (__DEV__) console.log(...args);
};

const ATT_ACTIVE_WAIT_MS = 10_000;
const ATT_PROMPT_DELAY_MS = 1500;
const INIT_TIMEOUT_MS = 20_000;

/**
 * Development-only diagnostics. Note: debug APKs embed a production JS bundle
 * where `__DEV__` is false, so these only fire under a live Metro/dev build.
 */
const ENABLE_ADAPTER_DEBUG = __DEV__;
const ENABLE_VALIDATE_INTEGRATION = __DEV__;
/**
 * Set to true ONLY for a one-off local diagnostic build to launch the LevelPlay
 * Integration Test Suite instead of the normal banner flow. Must stay false for
 * every production/QA build — the suite takes over the screen on init success.
 */
const ENABLE_INTEGRATION_TEST_SUITE = false;

type Status = 'idle' | 'initializing' | 'ready' | 'failed';

let status: Status = 'idle';
let initPromise: Promise<boolean> | null = null;
const readySubscribers = new Set<(ready: boolean) => void>();

/** Whether LevelPlay has completed initialization successfully this session. */
export function isLevelPlayReady(): boolean {
  return status === 'ready';
}

/**
 * Subscribe to LevelPlay readiness. Fires immediately if already resolved, and
 * again if a late init success/failure arrives. Returns an unsubscribe function.
 */
export function subscribeLevelPlayReady(cb: (ready: boolean) => void): () => void {
  readySubscribers.add(cb);
  if (status === 'ready') cb(true);
  else if (status === 'failed') cb(false);
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

/** Wait until the app is in the "active" state (required for the iOS ATT prompt). */
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

/**
 * iOS App Tracking Transparency prompt should be resolved before LevelPlay init.
 * This preserves the existing ATT behavior; the ATT outcome is NOT treated as
 * GDPR/CCPA consent.
 */
async function ensureIosTrackingPermission(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }
  try {
    await waitForActiveState();
    await new Promise((r) => setTimeout(r, ATT_PROMPT_DELAY_MS));
    const { status: attStatus } = await getTrackingPermissionsAsync();
    if (attStatus === PermissionStatus.UNDETERMINED) {
      await requestTrackingPermissionsAsync();
    }
  } catch (err) {
    console.warn(`${LOG} App Tracking Transparency request failed:`, err);
  }
}

/** Register the impression listener before init so no impressions are missed. */
async function registerImpressionListener(): Promise<void> {
  try {
    await LevelPlay.addImpressionDataListener({
      onImpressionSuccess: (data: LevelPlayImpressionData) => {
        const format = (data.adFormat ?? '').toUpperCase();
        if (format === 'BANNER' || format === '') {
          log(
            `[BANNER] impression adUnit=${data.mediationAdUnitId ?? ''} ` +
              `network=${data.adNetwork ?? ''} placement=${data.placement ?? ''} ` +
              `revenue=${data.revenue ?? ''} precision=${data.precision ?? ''}`,
          );
        }
      },
    });
  } catch (err) {
    console.warn(`${LOG} addImpressionDataListener failed:`, err);
  }
}

/**
 * Initialize Unity LevelPlay exactly once per app session.
 * @returns whether the SDK initialized successfully (false in Expo Go / web / on failure).
 */
export function initLevelPlay(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(false);
  }
  if (Constants.appOwnership === 'expo') {
    console.warn(`${LOG} init skipped (Expo Go — native module unavailable)`);
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
      log(`${LOG} platform ${Platform.OS} appKey=${LEVELPLAY_APP_KEY}`);

      // Listeners and diagnostics must be registered BEFORE init.
      await registerImpressionListener();

      if (ENABLE_INTEGRATION_TEST_SUITE) {
        try {
          await LevelPlay.setMetaData('is_test_suite', ['enable']);
        } catch (err) {
          console.warn(`${LOG} setMetaData(is_test_suite) failed:`, err);
        }
      }
      if (ENABLE_VALIDATE_INTEGRATION) {
        LevelPlay.validateIntegration().catch((err) =>
          console.warn(`${LOG} validateIntegration failed:`, err),
        );
      }
      if (ENABLE_ADAPTER_DEBUG) {
        try {
          await LevelPlay.setAdaptersDebug(true);
        } catch (err) {
          console.warn(`${LOG} setAdaptersDebug failed:`, err);
        }
      }

      await ensureIosTrackingPermission();

      const initListener: LevelPlayInitListener = {
        onInitSuccess: (_configuration: LevelPlayConfiguration) => {
          status = 'ready';
          log(`${LOG} init success`);
          if (ENABLE_INTEGRATION_TEST_SUITE) {
            LevelPlay.launchTestSuite().catch((err) =>
              console.warn(`${LOG} launchTestSuite failed:`, err),
            );
          }
          notifyReady(true);
          settle(true);
        },
        onInitFailed: (error: LevelPlayInitError) => {
          status = 'failed';
          console.warn(
            `${LOG} init failed code=${error?.errorCode} message=${error?.errorMessage}`,
            error,
          );
          // Allow a later retry to re-run init.
          initPromise = null;
          notifyReady(false);
          settle(false);
        },
      };

      try {
        const request = LevelPlayInitRequest.builder(LEVELPLAY_APP_KEY).build();
        await LevelPlay.init(request, initListener);
      } catch (err) {
        status = 'failed';
        console.warn(`${LOG} init failed (exception)`, err);
        initPromise = null;
        notifyReady(false);
        settle(false);
        return;
      }

      // Fallback so callers are never left pending forever. Does not mark the
      // SDK failed — a late onInitSuccess will still notify subscribers.
      setTimeout(() => {
        if (!settled) {
          console.warn(`${LOG} init did not complete within ${INIT_TIMEOUT_MS}ms`);
          settle(status === 'ready');
        }
      }, INIT_TIMEOUT_MS);
    })();
  });

  return initPromise;
}
