import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BannerAd,
  BannerAdSize,
  TestIds,
  useForeground,
} from 'react-native-google-mobile-ads';
import { ADMOB_BANNER_RESERVED_HEIGHT, ADMOB_BANNER_UNIT_ID } from '../../config/admob';
import { initMobileAds } from '../../services/initMobileAds';

type BottomBannerAdProps = {
  visible?: boolean;
};

export function BottomBannerAd({ visible = true }: BottomBannerAdProps) {
  const insets = useSafeAreaInsets();
  const bannerRef = useRef<BannerAd>(null);
  const [failed, setFailed] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);

  const unitId = __DEV__ ? TestIds.BANNER : ADMOB_BANNER_UNIT_ID;

  useEffect(() => {
    let cancelled = false;
    initMobileAds().then((ok) => {
      if (!cancelled && ok) {
        setSdkReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useForeground(
    useCallback(() => {
      if (Platform.OS === 'ios') {
        bannerRef.current?.load();
      }
    }, []),
  );

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
        {
          height: ADMOB_BANNER_RESERVED_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
        },
      ]}
      pointerEvents="box-none"
    >
      <BannerAd
        ref={bannerRef}
        unitId={unitId}
        size={BannerAdSize.BANNER}
        onAdFailedToLoad={() => setFailed(true)}
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
});
