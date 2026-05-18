import Constants from 'expo-constants';
import mobileAds from 'react-native-google-mobile-ads';

let initPromise: Promise<boolean> | null = null;

/**
 * Initialize Google Mobile Ads once per app session.
 * @returns whether the SDK initialized successfully (false in Expo Go or on failure).
 */
export function initMobileAds(): Promise<boolean> {
  if (Constants.appOwnership === 'expo') {
    return Promise.resolve(false);
  }
  if (!initPromise) {
    initPromise = mobileAds()
      .initialize()
      .then(() => true)
      .catch((err) => {
        initPromise = null;
        console.warn('AdMob init failed:', err);
        return false;
      });
  }
  return initPromise;
}
