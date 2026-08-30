import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type MetaAttBridgeNative = {
  setAdvertiserTrackingEnabled: (enabled: boolean) => Promise<void>;
};

const NativeModule: MetaAttBridgeNative | null =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<MetaAttBridgeNative>('MetaAttBridge')
    : null;

/**
 * Inform Meta Audience Network whether personalized ads are allowed.
 * Must run after the ATT prompt and before LevelPlay.init on iOS 14–16.
 * On iOS 17+ with FAN 6.15+, ATT is read automatically; this remains a safe no-op path.
 */
export async function setMetaAdvertiserTrackingEnabled(
  enabled: boolean,
): Promise<void> {
  if (!NativeModule) {
    return;
  }
  await NativeModule.setAdvertiserTrackingEnabled(enabled);
}
