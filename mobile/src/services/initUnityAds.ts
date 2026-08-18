import Constants from 'expo-constants';
import { PermissionStatus } from 'expo-modules-core';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { initializeUnityAdsAsync, isUnityAdsAvailable } from '../../modules/unity-ads';
import { UNITY_ADS_GAME_ID } from '../config/unityAds';

let initPromise: Promise<boolean> | null = null;

const ADS_INIT_TIMEOUT_MS = 15_000;
const ATT_ACTIVE_WAIT_MS = 10_000;
const ATT_PROMPT_DELAY_MS = 1500;
const LOG = '[HaserliUnityAds]';

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/** Wait until the app is in the "active" state (required for ATT prompt on iOS). */
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

/** iOS ATT prompt should appear before ads initialization. */
async function ensureIosTrackingPermission(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }
  try {
    await waitForActiveState();
    await new Promise((r) => setTimeout(r, ATT_PROMPT_DELAY_MS));
    const { status } = await getTrackingPermissionsAsync();
    if (status === PermissionStatus.UNDETERMINED) {
      await requestTrackingPermissionsAsync();
    }
  } catch (err) {
    console.warn('App Tracking Transparency request failed:', err);
  }
}

/**
 * Initialize Unity Ads once per app session.
 * @returns whether the SDK initialized successfully (false in Expo Go or on failure).
 *
 * Note: debug APKs embed a production JS bundle where `__DEV__` is false. The native
 * Android module still forces Unity test mode when the package is debuggable.
 */
export function initUnityAds(): Promise<boolean> {
  const nativeAvailable = isUnityAdsAvailable();
  console.log(
    `${LOG} JS initialization starting gameId=${UNITY_ADS_GAME_ID} ` +
      `jsTestMode=${String(__DEV__)} platform=${Platform.OS} ` +
      `appOwnership=${Constants.appOwnership} nativeAvailable=${nativeAvailable}`,
  );
  if (Constants.appOwnership === 'expo' || !nativeAvailable) {
    console.warn(
      `${LOG} JS initialization skipped (Expo Go or native module missing)`,
    );
    return Promise.resolve(false);
  }
  if (!initPromise) {
    initPromise = ensureIosTrackingPermission()
      .then(() =>
        withTimeout(
          initializeUnityAdsAsync(UNITY_ADS_GAME_ID, __DEV__),
          ADS_INIT_TIMEOUT_MS,
          'Unity Ads init',
        ),
      )
      .then((nativeResult) => {
        console.log(
          `${LOG} JS initialization success gameId=${UNITY_ADS_GAME_ID} nativeResult=${nativeResult}`,
        );
        return true;
      })
      .catch((err) => {
        initPromise = null;
        console.warn(`${LOG} JS initialization failure gameId=${UNITY_ADS_GAME_ID}`, err);
        return false;
      });
  } else {
    console.log(`${LOG} JS initialization already in flight/complete; reusing promise`);
  }
  return initPromise;
}
