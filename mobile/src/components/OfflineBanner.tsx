import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useIsOffline } from '../hooks/useIsOffline';
import { Typography, useThemeColors } from '../theme';

/**
 * Shown while there is no connection. Edits keep working (local-first queue),
 * but the user should know others will only see them once back online.
 */
export function OfflineBanner() {
  const offline = useIsOffline();
  const { t } = useTranslation();
  const colors = useThemeColors();
  if (!offline) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: colors.surfaceVariant }]}
    >
      <MaterialCommunityIcons name="cloud-off-outline" size={18} color={colors.onSurfaceVariant} />
      <Text style={[Typography.bodySmall, { color: colors.onSurfaceVariant, flex: 1 } as any]}>
        {t('offline_banner')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginVertical: 6,
  },
});
