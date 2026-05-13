import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { useIsDark, useThemeColors, BorderRadius } from '../../theme';

interface SalinoSurfaceCardProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
}

// Matches Android SalinoSurfaceCard EXACTLY:
//   Modifier.shadow(elevation=8dp, ambient=black α0.10, spot=black α0.10) in light,
//   Modifier.shadow(elevation=6dp, ambient=black α0.24, spot=black α0.24) in dark.
//
// Uses the CSS-style boxShadow API (RN 0.76+) with a 2-layer shadow that mirrors
// Compose's ambient (uniform, all-around) + spot (directional, downward) pair.
// Legacy shadow-prefixed props + elevation are intentionally omitted; otherwise
// Android doubles the shadow with its hard default-color drop shadow.
export function SalinoSurfaceCard({ children, style, padding = 18 }: SalinoSurfaceCardProps) {
  const colors = useThemeColors();
  const isDark = useIsDark();

  const boxShadow = isDark
    ? '0px 1px 3px rgba(0,0,0,0.24), 0px 6px 12px rgba(0,0,0,0.16)'
    : '0px 1px 2px rgba(0,0,0,0.10), 0px 4px 8px rgba(0,0,0,0.06)';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? colors.surfaceBright : colors.surface,
          borderRadius: BorderRadius.large,
          borderWidth: isDark ? 1 : 0,
          borderColor: isDark
            ? `${colors.outlineVariant}66`
            : 'transparent',
          padding,
          boxShadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
});
