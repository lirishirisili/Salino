// LEGACY — Direct Unity Ads banner. DISABLED and retained only for rollback.
// Not referenced by the active app (LevelPlay is the active banner path).
// Safe to delete once LevelPlay is verified on a real device.
/* eslint-disable */
import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UnityAdsBannerView } from '../../../modules/unity-ads';
import {
  UNITY_ADS_BANNER_PLACEMENT_ID,
  UNITY_ADS_BANNER_RESERVED_HEIGHT,
  UNITY_ADS_GAME_ID,
} from '../../config/unityAds';
import { initUnityAds } from '../../services/initUnityAds';

type BottomBannerAdProps = {
  visible?: boolean;
};

const BANNER_LOAD_TIMEOUT_MS = 15_000;
const MAX_LOAD_ATTEMPTS = 3;
const LOG = '[HaserliUnityAds]';

export function LegacyUnityBottomBannerAd({ visible = true }: BottomBannerAdProps) {
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mountId = useRef(`banner-${Date.now()}`).current;

  useEffect(() => {
    console.log(
      `${LOG} component mount id=${mountId} visible=${visible} ` +
        `gameId=${UNITY_ADS_GAME_ID} placement=${UNITY_ADS_BANNER_PLACEMENT_ID} ` +
        `platform=${Platform.OS} appOwnership=${Constants.appOwnership} ` +
        `jsDev=${String(__DEV__)} insetBottom=${insets.bottom}`,
    );
    return () => {
      console.log(`${LOG} component unmount id=${mountId} sdkReady was ${sdkReady} adLoaded=${adLoaded}`);
    };
    // Mount/unmount diagnostics only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    console.log(`${LOG} waiting for Unity Ads initialization before banner load`);
    initUnityAds().then((ok) => {
      if (cancelled) {
        console.log(`${LOG} init resolved after unmount; ignoring ok=${ok}`);
        return;
      }
      console.log(`${LOG} initialization gate ok=${ok}; banner load allowed=${ok}`);
      if (ok) {
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
      if (attempt + 1 < MAX_LOAD_ATTEMPTS) {
        console.warn(`${LOG} banner load timed out; retry ${attempt + 1}`);
        setAdLoaded(false);
        setAttempt((value) => value + 1);
        return;
      }
      console.warn(`${LOG} banner load timed out after ${MAX_LOAD_ATTEMPTS} attempts`);
      setFailed(true);
    }, BANNER_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [sdkReady, failed, adLoaded, attempt]);

  const slotHeight = UNITY_ADS_BANNER_RESERVED_HEIGHT + insets.bottom;
  const shouldShowSlot = adLoaded;

  if (!visible) {
    console.log(`${LOG} skip render: visible=false`);
    return null;
  }
  if (Constants.appOwnership === 'expo' || Platform.OS === 'web') {
    console.log(`${LOG} skip render: expo/web ownership=${Constants.appOwnership}`);
    return null;
  }
  if (!sdkReady) {
    console.log(`${LOG} skip render: waiting for initialization success`);
    return null;
  }
  if (failed) {
    console.log(`${LOG} skip render: banner failed after retries`);
    return null;
  }

  return (
    <View
      collapsable={false}
      pointerEvents={shouldShowSlot ? 'box-none' : 'none'}
      onLayout={(event) => {
        const { width, height, x, y } = event.nativeEvent.layout;
        console.log(
          `${LOG} banner slot layout width=${width} height=${height} x=${x} y=${y} ` +
            `reserved=${UNITY_ADS_BANNER_RESERVED_HEIGHT} insetBottom=${insets.bottom} ` +
            `adLoaded=${adLoaded}`,
        );
      }}
      style={[
        styles.wrap,
        {
          height: shouldShowSlot ? slotHeight : 0,
          paddingBottom: shouldShowSlot ? insets.bottom : 0,
          minHeight: shouldShowSlot ? UNITY_ADS_BANNER_RESERVED_HEIGHT : 0,
          overflow: shouldShowSlot ? 'visible' : 'hidden',
        },
      ]}
    >
      <UnityAdsBannerView
        key={`unity-banner-${attempt}`}
        collapsable={false}
        placementId={UNITY_ADS_BANNER_PLACEMENT_ID}
        style={[styles.banner, { opacity: shouldShowSlot ? 1 : 0 }]}
        onAdLoaded={() => {
          console.log(
            `${LOG} JS onAdLoaded placement=${UNITY_ADS_BANNER_PLACEMENT_ID} attempt=${attempt}`,
          );
          setFailed(false);
          setAdLoaded(true);
        }}
        onAdFailedToLoad={(event) => {
          console.warn(`${LOG} JS onAdFailedToLoad`, event?.nativeEvent);
          setAdLoaded(false);
          if (attempt + 1 < MAX_LOAD_ATTEMPTS) {
            setAttempt((value) => value + 1);
            return;
          }
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
    overflow: 'visible',
    backgroundColor: 'transparent',
    zIndex: 2,
    elevation: 2,
  },
  banner: {
    width: 320,
    height: UNITY_ADS_BANNER_RESERVED_HEIGHT,
    alignSelf: 'center',
  },
});
