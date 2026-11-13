import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import {
  LevelPlayNativeAd,
  LevelPlayNativeAdView,
  LevelPlayNativeTemplateFontStyle,
  LevelPlayTemplateType,
  type LevelPlayNativeAdViewMethods,
} from 'unity-levelplay-mediation';
import { LEVELPLAY_NATIVE_ENABLED, LEVELPLAY_PLACEMENTS } from '../../config/levelPlay';
import { getAdsConfig } from '../../services/adsConfig';
import { subscribeLevelPlayReady } from '../../services/initLevelPlay';
import { logAdEvent } from '../../services/initMobileAnalytics';
import { useIsPremium } from '../../services/premium';
import { useThemeColors } from '../../theme';

const LOG = '[NATIVE]';
const log = (...args: unknown[]) => {
  console.warn(...args);
};

/** Small template height (icon + title + body + CTA). */
const SMALL_TEMPLATE_HEIGHT = 96;

/**
 * Native ad at the END of the shopping list (after the last item, never between
 * items). Styled like an item card with an "Ad" label; takes no space until it
 * fills and stays hidden after a failure.
 */
export function NativeListAd({ itemCount }: { itemCount: number }) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const isPremium = useIsPremium();
  const cfg = getAdsConfig();
  const viewRef = useRef<LevelPlayNativeAdViewMethods | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const requestedRef = useRef(false);

  const enabled =
    LEVELPLAY_NATIVE_ENABLED &&
    Platform.OS !== 'web' &&
    Constants.appOwnership !== 'expo' &&
    !isPremium &&
    cfg.adsEnabled &&
    cfg.nativeListEnd &&
    itemCount >= cfg.nativeListMinItems;

  useEffect(() => {
    if (!enabled) return;
    return subscribeLevelPlayReady(setSdkReady);
  }, [enabled]);

  const nativeAd = useMemo(
    () =>
      LevelPlayNativeAd.builder()
        .withPlacement(LEVELPLAY_PLACEMENTS.listEndNative)
        .withListener({
          onAdLoaded: (_ad, adInfo) => {
            log(`${LOG} onAdLoaded network=${adInfo.adNetwork}`);
            setLoaded(true);
          },
          onAdLoadFailed: (_ad, error) => {
            log(`${LOG} onAdLoadFailed code=${error.errorCode} message=${error.message}`);
            setLoaded(false);
          },
          onAdClicked: () => undefined,
          onAdImpression: () => {
            logAdEvent('native_impression', { placement: LEVELPLAY_PLACEMENTS.listEndNative });
          },
        })
        .build(),
    [],
  );

  useEffect(() => {
    if (!enabled || !sdkReady) return;
    const timer = setTimeout(() => {
      if (requestedRef.current) return;
      requestedRef.current = true;
      log(`${LOG} load requested`);
      nativeAd.loadAd();
    }, 600);
    return () => clearTimeout(timer);
  }, [enabled, sdkReady, nativeAd]);

  useEffect(
    () => () => {
      try {
        viewRef.current?.destroyAd();
      } catch {
        // View already gone.
      }
    },
    [],
  );

  if (!enabled || !sdkReady) return null;

  const templateStyle = {
    mainBackgroundColor: colors.surface,
    titleStyle: {
      textColor: colors.onSurface,
      textSize: 15,
      fontStyle: LevelPlayNativeTemplateFontStyle.Bold,
    },
    bodyStyle: { textColor: colors.onSurfaceVariant, textSize: 13 },
    advertiserStyle: { textColor: colors.onSurfaceVariant, textSize: 12 },
    callToActionStyle: {
      backgroundColor: colors.primary,
      textColor: colors.onPrimary,
      textSize: 13,
      cornerRadius: 16,
    },
  };

  return (
    <View
      style={loaded ? [styles.card, { backgroundColor: colors.surface, borderColor: colors.outlineVariant }] : styles.offFlow}
      pointerEvents={loaded ? 'auto' : 'none'}
    >
      {loaded && (
        <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>{t('ads_label')}</Text>
      )}
      <LevelPlayNativeAdView
        ref={viewRef}
        nativeAd={nativeAd}
        templateType={LevelPlayTemplateType.Small}
        templateStyle={templateStyle}
        style={styles.view}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    marginHorizontal: 2,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingTop: 6,
  },
  offFlow: {
    height: 0,
    opacity: 0,
    overflow: 'visible',
  },
  view: {
    width: '100%',
    height: SMALL_TEMPLATE_HEIGHT,
  },
  label: {
    fontSize: 11,
    marginHorizontal: 12,
  },
});
