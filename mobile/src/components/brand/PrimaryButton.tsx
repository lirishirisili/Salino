import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Text } from 'react-native-paper';
import { useThemeColors, Typography, BorderRadius } from '../../theme';

interface SalinoPrimaryButtonProps {
  text: string;
  onPress: () => void;
  enabled?: boolean;
  loading?: boolean;
  leading?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Matches Android SalinoPrimaryButton — 54dp height, medium radius, primary color. */
export function SalinoPrimaryButton({
  text,
  onPress,
  enabled = true,
  loading = false,
  leading,
  style,
}: SalinoPrimaryButtonProps) {
  const colors = useThemeColors();
  const disabled = !enabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: disabled
            ? `${colors.primary}73`
            : pressed
              ? `${colors.primary}cc`
              : colors.primary,
          borderRadius: BorderRadius.medium,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <View style={styles.row}>
          {leading ? <View style={styles.leading}>{leading}</View> : null}
          <Text
            style={[
              Typography.labelLarge,
              { color: colors.onPrimary, fontWeight: '700' },
            ]}
          >
            {text}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leading: { marginRight: 0 },
});
