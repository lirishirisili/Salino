import { Platform } from 'react-native';

/**
 * Appodeal configuration.
 * Android App Key provided by publisher; iOS key not set in this Android-first migration.
 * With APPODEAL_ENABLE_TEST_MODE=true, SDK also registers Interstitial + Rewarded
 * (callbacks/logging only — no auto-show; banner UI unchanged).
 */
export const APPODEAL_APP_KEYS = {
  android: '41f889143680e0eac194f70b75943e3d365cb43ebc64365b',
  /** Set when iOS Appodeal app is ready; until then iOS skips monetization init. */
  ios: '',
} as const;

export const APPODEAL_APP_KEY =
  Platform.OS === 'ios' ? APPODEAL_APP_KEYS.ios : APPODEAL_APP_KEYS.android;

/** Standard banner slot height (320×50). */
export const APPODEAL_BANNER_RESERVED_HEIGHT = 50;

/**
 * First verification build only. Set to false before store / production builds.
 */
export const APPODEAL_ENABLE_TEST_MODE = true;
