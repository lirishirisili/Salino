import { AppState, type NativeEventSubscription } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

/**
 * Dismiss Android 12+ / iOS native splash. Safe to call many times — hide()
 * only flips SplashScreenManager.keepSplashScreenOnScreen to false.
 */
export function hideNativeSplash(): void {
  try {
    SplashScreen.hide();
  } catch {
    void SplashScreen.hideAsync().catch(() => {});
  }
}

/** Hide immediately and again whenever the app returns to the foreground. */
export function subscribeHideNativeSplashOnActive(): NativeEventSubscription {
  hideNativeSplash();
  return AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      hideNativeSplash();
    }
  });
}
