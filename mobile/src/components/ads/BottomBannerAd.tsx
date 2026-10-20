import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { AppodealBanner } from 'react-native-appodeal';
import { APPODEAL_BANNER_RESERVED_HEIGHT } from '../../config/appodeal';
import { initAppodeal, subscribeAppodealReady } from '../../services/initAppodeal';

type BottomBannerAdProps = {
  visible?: boolean;
};

const LOG = '[BANNER]';
const WIDE_LAYOUT_MIN_WIDTH = 600;
const BANNER_WIDTH = 320;
const BANNER_HEIGHT = APPODEAL_BANNER_RESERVED_HEIGHT;

const log = (...args: unknown[]) => {
  console.warn(...args);
};

/**
 * In-flow Appodeal banner. Parent (MainAdBannerHost) owns the reserved strip;
 * this component only mounts the native view once the SDK is ready.
 *
 * adSize must be "phone" | "tablet" (not "banner").
 */
export function BottomBannerAd({ visible = true }: BottomBannerAdProps) {
  const { width: windowWidth } = useWindowDimensions();
  const isWideLayout = windowWidth >= WIDE_LAYOUT_MIN_WIDTH;
  const [sdkReady, setSdkReady] = useState(false);
  const mountId = useRef(`apd-banner-${Date.now()}`).current;

  const isRenderableEnv =
    Platform.OS !== 'web' && Constants.appOwnership !== 'expo';

  useEffect(() => {
    log(`${LOG} component mount id=${mountId} visible=${visible} platform=${Platform.OS}`);
    return () => {
      log(`${LOG} component unmount id=${mountId}`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isRenderableEnv) return;
    void initAppodeal();
    const unsubscribe = subscribeAppodealReady((ready) => {
      log(`${LOG} sdk ready=${ready}`);
      setSdkReady(ready);
    });
    return unsubscribe;
  }, [isRenderableEnv]);

  const shouldMountAd = isRenderableEnv && visible && sdkReady;

  if (!isRenderableEnv) {
    return null;
  }

  return (
    <View
      collapsable={false}
      style={[
        styles.wrap,
        isWideLayout ? { width: BANNER_WIDTH, alignSelf: 'center' } : styles.wrapFullBleed,
      ]}
    >
      {shouldMountAd ? (
        <AppodealBanner
          adSize="phone"
          placement="default"
          onAdLoaded={() => {
            log(`${LOG} onAdLoaded`);
          }}
          onAdFailedToLoad={() => {
            console.warn(`${LOG} onAdFailedToLoad`);
          }}
          onAdClicked={() => {
            log(`${LOG} clicked`);
          }}
          onAdExpired={() => {
            log(`${LOG} expired`);
          }}
          style={styles.banner}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: BANNER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  wrapFullBleed: {
    width: '100%',
  },
  banner: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    alignSelf: 'center',
  },
});
