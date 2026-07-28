import { Platform } from 'react-native';

/** Unity Ads Game IDs per platform. */
export const UNITY_ADS_GAME_IDS = {
  android: '6164602',
  ios: '6164603',
} as const;

/** Unity banner placements per platform. */
export const UNITY_ADS_BANNER_PLACEMENT_IDS = {
  android: 'Banner_Android',
  ios: 'Banner_iOS',
} as const;

export const UNITY_ADS_GAME_ID =
  Platform.OS === 'ios'
    ? UNITY_ADS_GAME_IDS.ios
    : UNITY_ADS_GAME_IDS.android;

export const UNITY_ADS_BANNER_PLACEMENT_ID =
  Platform.OS === 'ios'
    ? UNITY_ADS_BANNER_PLACEMENT_IDS.ios
    : UNITY_ADS_BANNER_PLACEMENT_IDS.android;

/** Standard banner slot height (320x50). */
export const UNITY_ADS_BANNER_RESERVED_HEIGHT = 50;
