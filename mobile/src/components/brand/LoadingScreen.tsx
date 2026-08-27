import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemeColors, Typography } from '../../theme';
import { BrandLogo } from './BrandLogo';

/**
 * Inner loader — mirrors Android LoadingIndicator.kt:
 * logo 64 (no glow) + spinner + caption (defaults to `loading`).
 */
export function LoadingIndicator({ caption }: { caption?: string } = {}) {
  const colors = useThemeColors();
  const { t } = useTranslation(undefined, { useSuspense: false });
  return (
    <View style={styles.container}>
      <BrandLogo iconSize={64} showGlow={false} center shadowElevation={4} />
      <View style={{ height: 18 }} />
      <ActivityIndicator size="large" color={colors.primary} />
      <View style={{ height: 14 }} />
      <Text
        style={[Typography.bodyMedium, { color: colors.onSurfaceVariant, textAlign: 'center' } as any]}
      >
        {caption ?? t('loading')}
      </Text>
    </View>
  );
}

/**
 * Boot / splash loader — mirrors Android SplashScreen.kt:
 * logo 96 (glow) + spinner + live-sync badge caption.
 * No opaque fill — sits on SalinoGradientBackground from the root layout.
 */
export function LoadingScreen() {
  const colors = useThemeColors();
  const { t } = useTranslation(undefined, { useSuspense: false });
  return (
    <View style={styles.container}>
      <BrandLogo iconSize={96} showGlow center shadowElevation={12} />
      <View style={{ height: 24 }} />
      <ActivityIndicator size="large" color={colors.primary} />
      <View style={{ height: 16 }} />
      <Text
        style={[Typography.labelMedium, { color: colors.onSurfaceVariant, textAlign: 'center' } as any]}
      >
        {t('shopping_list_live_badge')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
