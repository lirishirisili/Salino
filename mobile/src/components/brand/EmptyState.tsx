import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors, Typography } from '../../theme';

interface EmptyStateProps {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Matches Android EmptyState.kt — centered, 72dp primaryContainer circle icon. */
export function EmptyState({
  icon = 'cart-outline',
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
        <MaterialCommunityIcons name={icon} size={36} color={colors.onPrimaryContainer} />
      </View>
      <Text
        style={[
          Typography.titleMedium,
          {
            fontSize: 17,
            fontWeight: '700',
            color: colors.onSurface,
            marginTop: 8,
            textAlign: 'center',
          } as any,
        ]}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={[
            Typography.bodyMedium,
            {
              color: colors.onSurfaceVariant,
              marginTop: 4,
              textAlign: 'center',
              maxWidth: 300,
            } as any,
          ]}
        >
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [{ marginTop: 18, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text
            style={[
              Typography.labelLarge,
              { color: colors.primary, fontWeight: '600' } as any,
            ]}
          >
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 56,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
