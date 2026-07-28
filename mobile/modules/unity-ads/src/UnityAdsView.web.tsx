import * as React from 'react';
import type { ViewProps } from 'react-native';

export type UnityAdsBannerViewProps = ViewProps & {
  placementId?: string;
  onAdLoaded?: () => void;
  onAdFailedToLoad?: () => void;
};

export default function UnityAdsBannerView(_: UnityAdsBannerViewProps) {
  return null;
}
