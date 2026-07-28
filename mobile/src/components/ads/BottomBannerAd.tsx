import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UnityAdsBannerView } from '../../../modules/unity-ads';
import {
  UNITY_ADS_BANNER_PLACEMENT_ID,
  UNITY_ADS_BANNER_RESERVED_HEIGHT,
} from '../../config/unityAds';
import { initUnityAds } from '../../services/initUnityAds';

type BottomBannerAdProps = {
  visible?: boolean;
};

const BANNER_LOAD_TIMEOUT_MS = 12_000;

export function BottomBannerAd({ visible = true }: BottomBannerAdProps) {
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    initUnityAds().then((ok) => {
      if (!cancelled && ok) {
        setSdkReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sdkReady || failed || adLoaded) {
      return;
    }
    const timer = setTimeout(() => {
      console.warn('Unity banner load timed out');
      setFailed(true);
    }, BANNER_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [sdkReady, failed, adLoaded]);

  if (
    !visible ||
    !sdkReady ||
    failed ||
    Constants.appOwnership === 'expo' ||
    Platform.OS === 'web'
  ) {
    return null;
  }

  return (
    <View
      style={[
        styles.wrap,
        adLoaded
          ? {
              height: UNITY_ADS_BANNER_RESERVED_HEIGHT + insets.bottom,
              paddingBottom: insets.bottom,
            }
          : styles.loadingSlot,
      ]}
      pointerEvents={adLoaded ? 'box-none' : 'none'}
    >
      <UnityAdsBannerView
        placementId={UNITY_ADS_BANNER_PLACEMENT_ID}
        style={styles.banner}
        onAdLoaded={() => {
          setFailed(false);
          setAdLoaded(true);
        }}
        onAdFailedToLoad={(event) => {
          console.warn('Unity banner failed:', event?.nativeEvent);
          setAdLoaded(false);
          setFailed(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  // Keep a measurable 320x50 host while loading without taking list layout space.
  loadingSlot: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: UNITY_ADS_BANNER_RESERVED_HEIGHT,
    opacity: 0,
  },
  banner: {
    width: 320,
    height: UNITY_ADS_BANNER_RESERVED_HEIGHT,
    alignSelf: 'center',
  },
});
