export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// Shape system matches Android Theme.kt Shapes
export const BorderRadius = {
  extraSmall: 10,
  small: 16,
  medium: 24,
  large: 30,
  extraLarge: 36,
  full: 9999,
};

// Layout tokens — matches Android SalinoWebTokens
export const Layout = {
  maxContentWidth: 600,
  horizontalPadding: 16,
  inputCorner: 24,
  tabBarCorner: 24,
  tabInnerCorner: 20,
};

// Typography matching Android SalinoTypography (Type.kt)
export const Typography = {
  headlineLarge: { fontSize: 34, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.3 },
  headlineMedium: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  headlineSmall: { fontSize: 24, lineHeight: 32, fontWeight: '700' as const },
  titleLarge: { fontSize: 22, lineHeight: 28, fontWeight: '600' as const },
  titleMedium: { fontSize: 18, lineHeight: 24, fontWeight: '600' as const },
  titleSmall: { fontSize: 15, lineHeight: 20, fontWeight: '600' as const },
  bodyLarge: { fontSize: 16, lineHeight: 24, fontWeight: '500' as const },
  bodyMedium: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  bodySmall: { fontSize: 12, lineHeight: 18, fontWeight: '400' as const },
  labelLarge: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  labelMedium: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  labelSmall: { fontSize: 11, lineHeight: 16, fontWeight: '500' as const },
};
