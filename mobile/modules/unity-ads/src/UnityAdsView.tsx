import * as React from 'react';
import { requireNativeViewManager } from 'expo-modules-core';
import type { ViewProps } from 'react-native';

type NativeEvent = {
  nativeEvent: {
    placementId: string;
    message?: string;
    code?: string;
  };
};

export type UnityAdsBannerViewProps = ViewProps & {
  placementId?: string;
  onAdLoaded?: (event: NativeEvent) => void;
  onAdFailedToLoad?: (event: NativeEvent) => void;
};

const NativeView: React.ComponentType<UnityAdsBannerViewProps> =
  requireNativeViewManager('UnityAds');

export default function UnityAdsBannerView(props: UnityAdsBannerViewProps) {
  return <NativeView {...props} />;
}
