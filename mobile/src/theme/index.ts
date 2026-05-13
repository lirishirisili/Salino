export { Colors, CategoryColors, AccentColors } from './colors';
export { LightTheme, DarkTheme } from './paperTheme';
export { Spacing, BorderRadius, Layout, Typography } from './spacing';

import { useColorScheme } from 'react-native';
import { Colors } from './colors';

export type ThemeColors = typeof Colors.light;

// Hook returning the current scheme palette (matches Compose isSystemInDarkTheme)
export function useThemeColors(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? (Colors.dark as ThemeColors) : (Colors.light as ThemeColors);
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
