import { Platform } from 'react-native';

/** Google AdMob App IDs (native config in app.json / manifests). */
export const ADMOB_APP_IDS = {
  android: 'ca-app-pub-1194823418071986~13363777409',
  ios: 'ca-app-pub-1194823418071986~9075266622',
} as const;

/** Banner ad unit IDs per platform. */
export const ADMOB_BANNER_UNIT_IDS = {
  android: 'ca-app-pub-1194823418071986/6555931955',
  ios: 'ca-app-pub-1194823418071986/6195776245',
} as const;

export const ADMOB_BANNER_UNIT_ID =
  Platform.OS === 'ios'
    ? ADMOB_BANNER_UNIT_IDS.ios
    : ADMOB_BANNER_UNIT_IDS.android;

/** Standard banner slot height (320×50) — matches BannerAdSize.BANNER. */
export const ADMOB_BANNER_RESERVED_HEIGHT = 50;
