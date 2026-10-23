import { Platform } from 'react-native';

/**
 * Unity LevelPlay App Keys per platform.
 *
 * Mediation via LevelPlay → Meta Audience Network + Unity Ads (+ ironSource).
 * Meta Placement IDs are dashboard/server-side only — never used in app load calls.
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

/**
 * Interstitial Ad Unit IDs (shown once at the end of a supermarket trip).
 * Empty = format disabled; create the ad unit in the LevelPlay dashboard first.
 */
export const LEVELPLAY_INTERSTITIAL_AD_UNIT_IDS = {
  android: '2ekxo23c0ii0uzry',
  ios: 'vgqlg568pnmdvaar',
} as const;

/**
 * MREC (300x250) Ad Unit IDs — a separate banner-type ad unit so its eCPM is
 * reported apart from the bottom banner. Empty = MREC slots render nothing.
 */
export const LEVELPLAY_MREC_AD_UNIT_IDS = {
  android: 'emu496g8vfvb82c2',
  ios: 'x5dfr9l0941ly54c',
} as const;

export const LEVELPLAY_INTERSTITIAL_AD_UNIT_ID =
  Platform.OS === 'ios'
    ? LEVELPLAY_INTERSTITIAL_AD_UNIT_IDS.ios
    : LEVELPLAY_INTERSTITIAL_AD_UNIT_IDS.android;

export const LEVELPLAY_MREC_AD_UNIT_ID =
  Platform.OS === 'ios' ? LEVELPLAY_MREC_AD_UNIT_IDS.ios : LEVELPLAY_MREC_AD_UNIT_IDS.android;

/** Placement names — create them in the dashboard to report / cap per location. */
export const LEVELPLAY_PLACEMENTS = {
  tripEndInterstitial: 'trip_end',
  allDoneMrec: 'all_done',
  historyMrec: 'history',
} as const;
