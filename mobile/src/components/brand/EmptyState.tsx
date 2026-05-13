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
      <MaterialCommunityIcons
        name={icon}
        size={72}
        color={colors.primary}
        style={{ opacity: 0.65 }}
      />
      <Text
        style={[
          Typography.titleLarge,
          { color: colors.onBackground, marginTop: 16, textAlign: 'center' } as any,
        ]}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={[
            Typography.bodyMedium,
            { color: colors.onSurfaceVariant, marginTop: 8, textAlign: 'center' } as any,
          ]}
        >
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[Typography.labelLarge, { color: colors.onPrimary } as any]}>{actionLabel}</Text>
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
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  action: {
    marginTop: 24,
    height: 54,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
