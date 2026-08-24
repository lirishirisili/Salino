import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LevelPlayAdSize,
  LevelPlayBannerAdView,
  type LevelPlayAdError,
  type LevelPlayAdInfo,
  type LevelPlayBannerAdViewListener,
  type LevelPlayBannerAdViewMethods,
} from 'unity-levelplay-mediation';
import {
  LEVELPLAY_BANNER_AD_UNIT_ID,
  LEVELPLAY_BANNER_PLACEMENT_NAME,
  LEVELPLAY_BANNER_RESERVED_HEIGHT,
} from '../../config/levelPlay';
import { initLevelPlay, subscribeLevelPlayReady } from '../../services/initLevelPlay';

type BottomBannerAdProps = {
  visible?: boolean;
};

const LOG = '[BANNER]';
const MAX_LOAD_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 30_000;

/**
 * Inner slot that owns exactly one native LevelPlayBannerAdView instance.
 * Mounted only when the SDK is ready, an ad size is resolved, and the route is
 * visible. Loads on mount, destroys on unmount, and performs bounded, delayed
 * retries (never a tight loop).
 */
function LevelPlayBannerSlot({
  adSize,
  onLoadedChange,
}: {
  adSize: LevelPlayAdSize;
  onLoadedChange: (loaded: boolean) => void;
}) {
  const bannerRef = useRef<LevelPlayBannerAdViewMethods | null>(null);
  const attemptRef = useRef(0);
  const loadRequestedRef = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRetry = useCallback(() => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, []);

  const requestLoad = useCallback(() => {
    if (loadRequestedRef.current) {
      return;
    }
    loadRequestedRef.current = true;
    console.log(`${LOG} load requested attempt=${attemptRef.current + 1}`);
    bannerRef.current?.loadAd();
  }, []);

  useEffect(() => {
    console.log(`${LOG} component mount adUnit=${LEVELPLAY_BANNER_AD_UNIT_ID}`);
    loadRequestedRef.current = false;
    return () => {
      clearRetry();
      loadRequestedRef.current = false;
      console.log(`${LOG} destroyed`);
      bannerRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pause auto-refresh in background; resume (and recover) on foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        bannerRef.current?.resumeAutoRefresh();
      } else if (state === 'background' || state === 'inactive') {
        bannerRef.current?.pauseAutoRefresh();
      }
    });
    return () => sub.remove();
  }, []);

  const scheduleRetry = useCallback(() => {
    if (attemptRef.current + 1 >= MAX_LOAD_ATTEMPTS) {
      console.warn(`${LOG} giving up after ${MAX_LOAD_ATTEMPTS} attempts (slot collapsed)`);
      return;
    }
    attemptRef.current += 1;
    loadRequestedRef.current = false;
    clearRetry();
    retryTimer.current = setTimeout(requestLoad, RETRY_BACKOFF_MS);
  }, [clearRetry, requestLoad]);

  const listener: LevelPlayBannerAdViewListener = useMemo(
    () => ({
      onAdLoaded: (adInfo: LevelPlayAdInfo) => {
        attemptRef.current = 0;
        loadRequestedRef.current = true;
        clearRetry();
        console.log(
          `${LOG} loaded network=${adInfo.adNetwork} placement=${adInfo.placementName} ` +
            `size=${adInfo.adSize?.width ?? '?'}x${adInfo.adSize?.height ?? '?'}`,
        );
        onLoadedChange(true);
      },
      onAdLoadFailed: (error: LevelPlayAdError) => {
        console.warn(
          `${LOG} load failed code=${error.errorCode} message=${error.errorMessage}`,
        );
        onLoadedChange(false);
        scheduleRetry();
      },
      onAdDisplayed: (adInfo: LevelPlayAdInfo) => {
        console.log(`${LOG} displayed network=${adInfo.adNetwork}`);
      },
      onAdDisplayFailed: (_adInfo: LevelPlayAdInfo, error: LevelPlayAdError) => {
        console.warn(`${LOG} display failed code=${error.errorCode} message=${error.errorMessage}`);
      },
      onAdClicked: (adInfo: LevelPlayAdInfo) => {
        console.log(`${LOG} clicked network=${adInfo.adNetwork}`);
      },
      onAdExpanded: () => console.log(`${LOG} expanded`),
      onAdCollapsed: () => console.log(`${LOG} collapsed`),
      onAdLeftApplication: () => console.log(`${LOG} left application`),
    }),
    [clearRetry, onLoadedChange, scheduleRetry],
  );

  return (
    <LevelPlayBannerAdView
      ref={bannerRef}
      adUnitId={LEVELPLAY_BANNER_AD_UNIT_ID}
      adSize={adSize}
      placementName={LEVELPLAY_BANNER_PLACEMENT_NAME}
      listener={listener}
      style={[styles.banner, { height: adSize.height }]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (loadRequestedRef.current || width <= 0 || height <= 0) {
          return;
        }
        requestLoad();
      }}
    />
  );
}

/** Bottom banner host (document flow, not overlay). Collapses when no ad. */
export function BottomBannerAd({ visible = true }: BottomBannerAdProps) {
  const insets = useSafeAreaInsets();
  const [sdkReady, setSdkReady] = useState(false);
  const [adSize, setAdSize] = useState<LevelPlayAdSize | null>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const mountId = useRef(`lp-banner-${Date.now()}`).current;

  const isRenderableEnv =
    Platform.OS !== 'web' && Constants.appOwnership !== 'expo';

  useEffect(() => {
    console.log(
      `${LOG} component mount id=${mountId} visible=${visible} ` +
        `adUnit=${LEVELPLAY_BANNER_AD_UNIT_ID} platform=${Platform.OS} ` +
        `appOwnership=${Constants.appOwnership} insetBottom=${insets.bottom}`,
    );
    return () => {
      console.log(`${LOG} component unmount id=${mountId}`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gate on LevelPlay init success — banner is only created after onInitSuccess.
  useEffect(() => {
    if (!isRenderableEnv) return;
    void initLevelPlay();
    const unsubscribe = subscribeLevelPlayReady((ready) => {
      console.log(`${LOG} sdk ready=${ready}`);
      setSdkReady(ready);
    });
    return unsubscribe;
  }, [isRenderableEnv]);

  // Resolve an adaptive ad size once, with a safe standard-banner fallback.
  useEffect(() => {
    if (!sdkReady || adSize) return;
    let cancelled = false;
    (async () => {
      try {
        const adaptive = await LevelPlayAdSize.createAdaptiveAdSize();
        if (cancelled) return;
        setAdSize(adaptive ?? LevelPlayAdSize.BANNER);
      } catch (err) {
        console.warn(`${LOG} createAdaptiveAdSize failed; using BANNER`, err);
        if (!cancelled) setAdSize(LevelPlayAdSize.BANNER);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sdkReady, adSize]);

  // When the route hides the banner, collapse and tear down the native view.
  useEffect(() => {
    if (!visible) {
      setAdLoaded(false);
    }
  }, [visible]);

  const shouldMountAd = isRenderableEnv && visible && sdkReady && adSize != null;
  const reservedHeight = adSize?.height ?? LEVELPLAY_BANNER_RESERVED_HEIGHT;
  // Take document-flow space ONLY after a real fill. While loading, keep the
  // native banner absolutely positioned (measurable, zero flex impact).
  const inFlow = shouldMountAd && adLoaded;
  const slotHeight = inFlow ? reservedHeight + insets.bottom : 0;

  if (!isRenderableEnv) {
    return null;
  }

  return (
    <View
      collapsable={false}
      pointerEvents={inFlow ? 'box-none' : 'none'}
      style={[
        styles.wrap,
        inFlow
          ? {
              height: slotHeight,
              paddingBottom: insets.bottom,
              position: 'relative',
              opacity: 1,
            }
          : shouldMountAd
            ? {
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: reservedHeight,
                opacity: 0,
                zIndex: -1,
              }
            : { height: 0, opacity: 0 },
      ]}
    >
      {shouldMountAd && adSize ? (
        <LevelPlayBannerSlot adSize={adSize} onLoadedChange={setAdLoaded} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 2,
    elevation: 2,
  },
  banner: {
    width: '100%',
    alignSelf: 'center',
  },
});
