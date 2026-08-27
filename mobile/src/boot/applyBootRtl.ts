import AsyncStorage from '@react-native-async-storage/async-storage';
import { DevSettings, I18nManager } from 'react-native';
import * as Updates from 'expo-updates';

const RTL_BOOT_RELOAD_KEY = '@rtl_boot_reload_attempted';
const RELOAD_TIMEOUT_MS = 2000;

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('rtl reload timeout')), ms);
  });
}

/**
 * Align RTL layout direction at cold start.
 * @returns true if a full reload was triggered (caller should stop boot).
 */
export async function applyBootRtl(desiredRTL: boolean): Promise<boolean> {
  if (I18nManager.isRTL === desiredRTL) {
    await AsyncStorage.removeItem(RTL_BOOT_RELOAD_KEY);
    return false;
  }

  I18nManager.allowRTL(true);
  I18nManager.forceRTL(desiredRTL);

  const alreadyReloaded = await AsyncStorage.getItem(RTL_BOOT_RELOAD_KEY);
  if (alreadyReloaded) {
    // RTL did not stick after reload (common in debug) — continue boot instead of looping.
    return false;
  }

  await AsyncStorage.setItem(RTL_BOOT_RELOAD_KEY, '1');

  if (__DEV__) {
    DevSettings.reload();
    return true;
  }

  let updatesEnabled = false;
  try {
    updatesEnabled = Updates.isEnabled;
  } catch {
    updatesEnabled = false;
  }
  if (!updatesEnabled) {
    // forceRTL is persisted; it takes effect on the next native process start.
    return false;
  }

  try {
    await Promise.race([Updates.reloadAsync(), timeout(RELOAD_TIMEOUT_MS)]);
    return true;
  } catch {
    // Production builds often have updates disabled, or reload hung — continue.
    return false;
  }
}
