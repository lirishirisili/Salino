import { NativeModules, Platform } from 'react-native';

type SalinoBuildInfoConstants = {
  isDebuggable?: boolean;
};

/**
 * True only for Android/iOS *native* debug binaries (BuildConfig.DEBUG).
 * Unlike `__DEV__`, this stays true when the JS bundle is embedded via
 * `export:embed` with `debuggableVariants = []` (production Metro flags).
 */
export function isNativeDebuggableBuild(): boolean {
  if (Platform.OS === 'web') {
    return typeof __DEV__ !== 'undefined' && __DEV__;
  }
  const mod = NativeModules.SalinoBuildInfo as SalinoBuildInfoConstants | undefined;
  if (mod && typeof mod.isDebuggable === 'boolean') {
    return mod.isDebuggable;
  }
  // Fallback if the native module is missing (e.g. Expo Go).
  return typeof __DEV__ !== 'undefined' && __DEV__;
}
