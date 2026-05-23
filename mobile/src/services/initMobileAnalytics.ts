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
