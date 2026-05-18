import AsyncStorage from '@react-native-async-storage/async-storage';
import { DevSettings, I18nManager } from 'react-native';
import * as Updates from 'expo-updates';

const RTL_BOOT_RELOAD_KEY = '@rtl_boot_reload_attempted';

/**
 * Align RTL layout direction at cold start.
 * @returns true if a full reload was triggered (caller should stop boot).
 */
export async function applyBootRtl(desiredRTL: boolean): Promise<boolean> {
  if (I18nManager.isRTL === desiredRTL) {
    return false;
  }

  I18nManager.allowRTL(true);
  I18nManager.forceRTL(desiredRTL);

  if (__DEV__) {
    DevSettings.reload();
    return true;
  }

  const alreadyReloaded = await AsyncStorage.getItem(RTL_BOOT_RELOAD_KEY);
  if (alreadyReloaded) {
    // Avoid infinite reload loop when expo-updates is disabled or reload is a no-op.
    return false;
  }

  await AsyncStorage.setItem(RTL_BOOT_RELOAD_KEY, '1');
  try {
    await Updates.reloadAsync();
    return true;
  } catch {
    // Production builds often have updates disabled — continue boot without reload.
    return false;
  }
}
