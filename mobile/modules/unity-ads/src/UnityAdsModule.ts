import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeUnityAdsModule = {
  initialize(gameId: string, testMode: boolean): Promise<boolean>;
};

const NativeUnityAds = requireOptionalNativeModule<NativeUnityAdsModule>('ExpoUnityAds');

export async function initializeUnityAdsAsync(
  gameId: string,
  testMode: boolean,
): Promise<boolean> {
  if (!NativeUnityAds) {
    return false;
  }
  return NativeUnityAds.initialize(gameId, testMode);
}

export function isUnityAdsAvailable(): boolean {
  return !!NativeUnityAds;
}
