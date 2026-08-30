import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  AppStateStatus,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
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

// Lifecycle callbacks use console.warn so they appear in release logcat.
const log = (...args: unknown[]) => {
  console.warn(...args);
};
const warn = (...args: unknown[]) => {
  console.warn(...args);
};

/** Bounded backoff between retries; never permanently hide after a load failure. */
const RETRY_BACKOFF_MS = 30_000;
/** Tablet / unfolded foldable — keep banner host phone-width, not full-bleed. */
const WIDE_LAYOUT_MIN_WIDTH = 600;

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
    log(`${LOG} load requested attempt=${attemptRef.current + 1}`);
    bannerRef.current?.loadAd();
  }, []);

  useEffect(() => {
    log(`${LOG} component mount adUnit=${LEVELPLAY_BANNER_AD_UNIT_ID}`);
    loadRequestedRef.current = false;
    return () => {
      clearRetry();
      loadRequestedRef.current = false;
      log(`${LOG} destroyed`);
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
    attemptRef.current += 1;
    loadRequestedRef.current = false;
    clearRetry();
    log(`${LOG} retry scheduled attempt=${attemptRef.current + 1} in ${RETRY_BACKOFF_MS}ms`);
    retryTimer.current = setTimeout(requestLoad, RETRY_BACKOFF_MS);
  }, [clearRetry, requestLoad]);

  const listener: LevelPlayBannerAdViewListener = useMemo(
    () => ({
      onAdLoaded: (adInfo: LevelPlayAdInfo) => {
        attemptRef.current = 0;
        loadRequestedRef.current = true;
        clearRetry();
        log(
          `${LOG} onAdLoaded network=${adInfo.adNetwork} placement=${adInfo.placementName} ` +
            `size=${adInfo.adSize?.width ?? '?'}x${adInfo.adSize?.height ?? '?'}`,
        );
        onLoadedChange(true);
      },
      onAdLoadFailed: (error: LevelPlayAdError) => {
        warn(
          `${LOG} onAdLoadFailed code=${error.errorCode} message=${error.errorMessage}`,
        );
        onLoadedChange(false);
        scheduleRetry();
      },
      onAdDisplayed: (adInfo: LevelPlayAdInfo) => {
        log(`${LOG} onAdDisplayed network=${adInfo.adNetwork}`);
      },
      onAdDisplayFailed: (_adInfo: LevelPlayAdInfo, error: LevelPlayAdError) => {
        warn(
          `${LOG} onAdDisplayFailed code=${error.errorCode} message=${error.errorMessage}`,
        );
        onLoadedChange(false);
        scheduleRetry();
      },
      onAdClicked: (adInfo: LevelPlayAdInfo) => {
        log(`${LOG} clicked network=${adInfo.adNetwork}`);
      },
      onAdExpanded: () => log(`${LOG} expanded`),
      onAdCollapsed: () => log(`${LOG} collapsed`),
      onAdLeftApplication: () => log(`${LOG} left application`),
    }),
    [clearRetry, onLoadedChange, scheduleRetry],
  );

  return (
    <LevelPlayBannerAdView
      key={`${LEVELPLAY_BANNER_AD_UNIT_ID}-${adSize.width}-${adSize.height}`}
      ref={bannerRef}
      adUnitId={LEVELPLAY_BANNER_AD_UNIT_ID}
      adSize={adSize}
      placementName={LEVELPLAY_BANNER_PLACEMENT_NAME}
      listener={listener}
      style={{
        width: adSize.width,
        height: adSize.height,
        alignSelf: 'center',
      }}
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
  const { width: windowWidth } = useWindowDimensions();
  const isWideLayout = windowWidth >= WIDE_LAYOUT_MIN_WIDTH;
  const [sdkReady, setSdkReady] = useState(false);
  const [adSize, setAdSize] = useState<LevelPlayAdSize | null>(null);
  const [adLoaded, setAdLoaded] = useState(false);
  const mountId = useRef(`lp-banner-${Date.now()}`).current;

  const isRenderableEnv =
    Platform.OS !== 'web' && Constants.appOwnership !== 'expo';

  useEffect(() => {
    log(
      `${LOG} component mount id=${mountId} visible=${visible} ` +
        `adUnit=${LEVELPLAY_BANNER_AD_UNIT_ID} platform=${Platform.OS} ` +
        `appOwnership=${Constants.appOwnership} insetBottom=${insets.bottom}`,
    );
    return () => {
      log(`${LOG} component unmount id=${mountId}`);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gate on LevelPlay init success — banner is only created after onInitSuccess.
  useEffect(() => {
    if (!isRenderableEnv) return;
    void initLevelPlay();
    const unsubscribe = subscribeLevelPlayReady((ready) => {
      log(`${LOG} sdk ready=${ready}`);
      setSdkReady(ready);
    });
    return unsubscribe;
  }, [isRenderableEnv]);

  // Phones: adaptive. Wide / foldable: fixed BANNER so the creative stays phone-sized.
  // Avoid createAdaptiveAdSize(width) — New Arch on iOS can mis-marshal the width arg.
  useEffect(() => {
    if (!sdkReady) return;
    let cancelled = false;
    setAdLoaded(false);
    setAdSize(null);

    if (isWideLayout) {
      setAdSize(LevelPlayAdSize.BANNER);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const adaptive = await LevelPlayAdSize.createAdaptiveAdSize();
        if (cancelled) return;
        setAdSize(adaptive ?? LevelPlayAdSize.BANNER);
      } catch (err) {
        warn(`${LOG} createAdaptiveAdSize failed; using BANNER`, err);
        if (!cancelled) setAdSize(LevelPlayAdSize.BANNER);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sdkReady, isWideLayout]);

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
  const hostWidth = adSize?.width ?? 320;

  if (!isRenderableEnv) {
    return null;
  }

  return (
    <View
      collapsable={false}
      pointerEvents={inFlow ? 'box-none' : 'none'}
      style={[
        styles.wrap,
        isWideLayout ? { width: hostWidth, alignSelf: 'center' } : styles.wrapFullBleed,
        inFlow
          ? {
              height: slotHeight,
              paddingBottom: insets.bottom,
              position: 'relative',
              opacity: 1,
            }
          : shouldMountAd
            ? {
                // Off-flow until filled so we don't reserve empty chrome.
                position: 'absolute',
                bottom: 0,
                height: 0,
                overflow: 'visible',
                opacity: 0,
                zIndex: -1,
                ...(isWideLayout
                  ? {
                      left: Math.max(0, (windowWidth - hostWidth) / 2),
                      width: hostWidth,
                    }
                  : { left: 0, right: 0 }),
              }
            : { height: 0, opacity: 0 },
      ]}
    >
      {shouldMountAd && adSize ? (
        <View
          style={
            inFlow
              ? undefined
              : {
                  // Keep a measurable native host for onLayout/load without claiming height.
                  position: 'absolute',
                  bottom: 0,
                  width: adSize.width,
                  height: adSize.height,
                  alignSelf: 'center',
                }
          }
        >
          <LevelPlayBannerSlot adSize={adSize} onLoadedChange={setAdLoaded} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  wrapFullBleed: {
    width: '100%',
  },
});
