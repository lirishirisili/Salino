import Constants from 'expo-constants';
import { PermissionStatus } from 'expo-modules-core';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { AppState, AppStateStatus, Platform } from 'react-native';
import mobileAds from 'react-native-google-mobile-ads';

let initPromise: Promise<boolean> | null = null;

const ADS_INIT_TIMEOUT_MS = 15_000;
const ATT_ACTIVE_WAIT_MS = 10_000;
const ATT_PROMPT_DELAY_MS = 1500;

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

/** iOS ATT prompt must appear before AdMob init (App Store Guideline 2.1). */
async function ensureIosTrackingPermission(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }
  try {
    await waitForActiveState();
    // Small delay to ensure the app is fully rendered and visible to the user.
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
 * Initialize Google Mobile Ads once per app session.
 * @returns whether the SDK initialized successfully (false in Expo Go or on failure).
 */
export function initMobileAds(): Promise<boolean> {
  if (Constants.appOwnership === 'expo') {
    return Promise.resolve(false);
  }
  if (!initPromise) {
    initPromise = ensureIosTrackingPermission()
      .then(() => withTimeout(mobileAds().initialize(), ADS_INIT_TIMEOUT_MS, 'AdMob init'))
      .then(() => true)
      .catch((err) => {
        initPromise = null;
        console.warn('AdMob init failed:', err);
        return false;
      });
  }
  return initPromise;
}
