import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import {
  LevelPlayAdSize,
  LevelPlayBannerAdView,
  type LevelPlayAdError,
  type LevelPlayAdInfo,
  type LevelPlayBannerAdViewListener,
  type LevelPlayBannerAdViewMethods,
} from 'unity-levelplay-mediation';
import { LEVELPLAY_MREC_AD_UNIT_ID } from '../../config/levelPlay';
import { subscribeLevelPlayReady } from '../../services/initLevelPlay';
import { useThemeColors } from '../../theme';

type MrecAdProps = {
  /** LevelPlay placement name (reporting / capping per screen). */
  placement: string;
};

const LOG = '[MREC]';

// Lifecycle callbacks use console.warn so they appear in release logcat.
const log = (...args: unknown[]) => {
  console.warn(...args);
};

const MREC = LevelPlayAdSize.MEDIUM_RECTANGLE;

/**
 * Inline 300x250 ad for low-intent screens (trip done, history). Takes no
 * space until it fills and stays hidden after a failure — never a blank box.
 */
export function MrecAd({ placement }: MrecAdProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const adRef = useRef<LevelPlayBannerAdViewMethods | null>(null);
  const loadRequestedRef = useRef(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const enabled =
    !!LEVELPLAY_MREC_AD_UNIT_ID && Platform.OS !== 'web' && Constants.appOwnership !== 'expo';

  useEffect(() => {
    if (!enabled) return;
    return subscribeLevelPlayReady(setSdkReady);
  }, [enabled]);

  const requestLoad = () => {
    if (loadRequestedRef.current) return;
    loadRequestedRef.current = true;
    log(`${LOG} load requested placement=${placement}`);
    adRef.current?.loadAd();
  };

  useEffect(() => {
    if (!enabled || !sdkReady) return;
    // iOS often skips onLayout for an invisible, off-flow host.
    const fallback = setTimeout(requestLoad, 800);
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') adRef.current?.resumeAutoRefresh();
      else adRef.current?.pauseAutoRefresh();
    });
    return () => {
      clearTimeout(fallback);
      sub.remove();
      adRef.current?.destroy();
      loadRequestedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sdkReady]);

  const listener: LevelPlayBannerAdViewListener = useMemo(
    () => ({
      onAdLoaded: (adInfo: LevelPlayAdInfo) => {
        log(`${LOG} onAdLoaded network=${adInfo.adNetwork} placement=${placement}`);
        setLoaded(true);
      },
      onAdLoadFailed: (error: LevelPlayAdError) => {
        log(`${LOG} onAdLoadFailed code=${error.errorCode} message=${error.errorMessage}`);
        setLoaded(false);
      },
      onAdDisplayFailed: (_adInfo: LevelPlayAdInfo, error: LevelPlayAdError) => {
        log(`${LOG} onAdDisplayFailed code=${error.errorCode} message=${error.errorMessage}`);
        setLoaded(false);
      },
    }),
    [placement],
  );

  if (!enabled || !sdkReady) return null;

  return (
    <View style={loaded ? styles.inFlow : styles.offFlow} pointerEvents={loaded ? 'auto' : 'none'}>
      {loaded && (
        <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('ads_label')}</Text>
      )}
      <View style={loaded ? undefined : styles.hiddenHost}>
        <LevelPlayBannerAdView
          ref={adRef}
          adUnitId={LEVELPLAY_MREC_AD_UNIT_ID}
          adSize={MREC}
          placementName={placement}
          listener={listener}
          style={{ width: MREC.width, height: MREC.height }}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            if (width > 0 && height > 0) requestLoad();
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inFlow: {
    alignItems: 'center',
    marginVertical: 16,
  },
  // Zero layout impact while loading, but the native view keeps a real size so
  // it can be measured and loaded.
  offFlow: {
    height: 0,
    overflow: 'visible',
    opacity: 0,
  },
  hiddenHost: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
  },
  label: {
    fontSize: 11,
    marginBottom: 4,
  },
});
