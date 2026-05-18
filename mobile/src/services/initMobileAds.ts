import Constants from 'expo-constants';
import { PermissionStatus } from 'expo-modules-core';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { Platform } from 'react-native';
import mobileAds from 'react-native-google-mobile-ads';

let initPromise: Promise<boolean> | null = null;

/** iOS ATT prompt must appear before AdMob init (App Store Guideline 2.1). */
async function ensureIosTrackingPermission(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }
  try {
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
      .then(() => mobileAds().initialize())
      .then(() => true)
      .catch((err) => {
        initPromise = null;
        console.warn('AdMob init failed:', err);
        return false;
      });
  }
  return initPromise;
}
