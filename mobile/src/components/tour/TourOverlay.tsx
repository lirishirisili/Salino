import React from 'react';
import { I18nManager, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SalinoSurfaceCard } from '../brand';
import { useTourStore } from '../../features/tour';
import { tourHandlers } from './TourProvider';
import { Layout, Typography, useThemeColors } from '../../theme';

/** Bottom clearance for FAB row on shopping list. */
const FAB_ROW_CLEARANCE = 88;

/**
 * Tour overlay — uniform scrim + sheet at top or bottom (never covering the highlight).
 */
export function TourOverlay() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { t } = useTranslation();
  const overlay = useTourStore((s) => s.overlay);

  if (!overlay) return null;

  const bottomOffset = Math.max(insets.bottom, 8) + FAB_ROW_CLEARANCE;
  const topOffset = insets.top + 16;
  const sheetPosition =
    overlay.sheetPlacement === 'top'
      ? { top: topOffset }
      : { bottom: bottomOffset };

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.scrim} pointerEvents="auto" />

      <View style={[styles.sheetWrapper, sheetPosition]} pointerEvents="box-none">
        <SalinoSurfaceCard style={styles.sheet}>
          <Text
            style={[
              Typography.labelMedium,
              { color: colors.onSurfaceVariant, textAlign: I18nManager.isRTL ? 'right' : 'left' } as any,
            ]}
          >
            {overlay.stepLabel}
          </Text>
          <Text
            style={[
              Typography.titleLarge,
              {
                fontWeight: '700',
                color: colors.onSurface,
                textAlign: I18nManager.isRTL ? 'right' : 'left',
              } as any,
            ]}
          >
            {overlay.title}
          </Text>
          <Text
            style={[
              Typography.bodyMedium,
              {
                color: colors.onSurfaceVariant,
                textAlign: I18nManager.isRTL ? 'right' : 'left',
              } as any,
            ]}
          >
            {overlay.body}
          </Text>
          <View style={styles.actions}>
            <Button mode="contained" onPress={() => tourHandlers.onNext()}>
              {overlay.isLast ? t('tour.finish') : t('tour.next')}
            </Button>
            <Button mode="text" onPress={() => tourHandlers.onSkip()}>
              {t('tour.skip')}
            </Button>
          </View>
        </SalinoSurfaceCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: Layout.horizontalPadding,
    alignItems: 'center',
    maxWidth: Layout.maxContentWidth + Layout.horizontalPadding * 2,
    alignSelf: 'center',
    width: '100%',
  },
  sheet: {
    width: '100%',
    gap: 8,
    padding: 16,
  },
  actions: { gap: 4, marginTop: 4 },
});
