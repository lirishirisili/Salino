import { Platform } from 'react-native';
import analytics from '@react-native-firebase/analytics';

/**
 * Firebase / Google Analytics for iOS and Android (Expo + @react-native-firebase/analytics).
 * Requires GoogleService-Info.plist (iOS) and google-services.json (Android) from Firebase Console.
 */
export async function initMobileAnalytics(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await analytics().setAnalyticsCollectionEnabled(true);
    await analytics().logAppOpen();
    if (__DEV__) {
      await analytics().setUserProperty('debug_build', 'true');
    }
  } catch (e) {
    console.warn('Firebase Analytics init failed:', e);
  }
}

type AdImpression = {
  adSource: string | null;
  adFormat: string;
  adUnitName: string | null;
  placement: string | null;
  revenue: number | null;
  precision: string | null;
};

/**
 * LevelPlay impression-level revenue → GA4 `ad_impression` (the event Firebase
 * uses for ad revenue in Analytics / BigQuery / LTV reports).
 */
export function logAdImpression(impression: AdImpression): void {
  if (Platform.OS === 'web' || impression.revenue == null) return;
  analytics()
    .logEvent('ad_impression', {
      ad_platform: 'ironSource',
      ad_source: impression.adSource ?? 'unknown',
      ad_format: impression.adFormat,
      ad_unit_name: impression.adUnitName ?? 'unknown',
      placement: impression.placement ?? 'default',
      precision: impression.precision ?? 'unknown',
      currency: 'USD',
      value: impression.revenue,
    })
    .catch(() => undefined);
}

/** Screen views for the (main) stack so ad revenue can be split per screen. */
export function logScreenView(screenName: string): void {
  if (Platform.OS === 'web') return;
  analytics()
    .logScreenView({ screen_name: screenName, screen_class: screenName })
    .catch(() => undefined);
}

/** Funnel / diagnostics events for ad placements and premium (GA4 custom events). */
export type AdFunnelEvent =
  | 'ad_interstitial_skip'
  | 'ad_interstitial_show'
  | 'rewarded_offer_shown'
  | 'rewarded_started'
  | 'rewarded_completed'
  | 'rewarded_failed'
  | 'rewarded_free_use'
  | 'native_impression'
  | 'premium_paywall_shown'
  | 'premium_purchase'
  | 'premium_restore'
  | 'feature_used';

export function logAdEvent(
  name: AdFunnelEvent,
  params: Record<string, string | number | boolean> = {},
): void {
  if (Platform.OS === 'web') return;
  analytics()
    .logEvent(name, params)
    .catch(() => undefined);
}
