import { Platform } from 'react-native';

/**
 * Unity LevelPlay App Keys per platform.
 *
 * Banner mediation: ironSource bidding + Unity Ads bidding (same as PoofCam / Tohav).
 * Unity Game IDs: Android 6164602 / iOS 6164603.
 * Unity placements (LevelPlay): Banner_Android_Bidding / Banner_iOS_Bidding.
 *
 * IMPORTANT: These are LevelPlay App Keys, NOT ad unit IDs. They must never be
 * swapped with the banner ad unit IDs below.
 */
export const LEVELPLAY_APP_KEYS = {
  android: '279039915',
  ios: '279040c25',
} as const;

/** Unity LevelPlay banner Ad Unit IDs per platform. */
export const LEVELPLAY_BANNER_AD_UNIT_IDS = {
  android: '0l7rb6asf9irqd31',
  ios: 'iqfim290e42qaq5m',
} as const;

export const LEVELPLAY_APP_KEY =
  Platform.OS === 'ios' ? LEVELPLAY_APP_KEYS.ios : LEVELPLAY_APP_KEYS.android;

export const LEVELPLAY_BANNER_AD_UNIT_ID =
  Platform.OS === 'ios'
    ? LEVELPLAY_BANNER_AD_UNIT_IDS.ios
    : LEVELPLAY_BANNER_AD_UNIT_IDS.android;

/** Optional placement name; null lets LevelPlay use the default placement. */
export const LEVELPLAY_BANNER_PLACEMENT_NAME: string | null = null;

/** Standard banner slot height (320x50). Used to reserve layout space. */
export const LEVELPLAY_BANNER_RESERVED_HEIGHT = 50;
