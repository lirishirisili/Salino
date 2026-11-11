import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemeColors, Typography } from '../../theme';
import { useAuthStore } from '../../hooks/useAuthStore';
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
  const canRetry = useAuthStore(
    (s) => s.isSignedIn && !s.isSubmitting && s.householdResolution === 'pending'
  );
  const [showRetry, setShowRetry] = useState(false);
  const [retryRound, setRetryRound] = useState(0);

  // A signed-in user whose household is still unresolved after a while gets a
  // retry instead of a spinner that only an app restart would clear.
  useEffect(() => {
    if (!canRetry) {
      setShowRetry(false);
      return;
    }
    const timer = setTimeout(() => setShowRetry(true), RETRY_AFTER_MS);
    return () => clearTimeout(timer);
  }, [canRetry, retryRound]);

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
      {showRetry && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setShowRetry(false);
            setRetryRound((n) => n + 1);
            useAuthStore.getState().retryProfile();
          }}
          style={{ marginTop: 20, paddingVertical: 10, paddingHorizontal: 20 }}
        >
          <Text style={[Typography.labelLarge, { color: colors.primary } as any]}>{t('retry')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const RETRY_AFTER_MS = 10000;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});
