import React from 'react';
import { Image, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useThemeColors, useIsDark, Typography } from '../../theme';

interface BrandLogoProps {
  iconSize?: number;
  showWordmark?: boolean;
  showTagline?: boolean;
  center?: boolean;
  showGlow?: boolean;
  shadowElevation?: number;
  style?: StyleProp<ViewStyle>;
}

/** Matches Android BrandLogo (BrandComponents.kt) — circle logo with radial halo + ring. */
export function BrandLogo({
  iconSize = 64,
  showWordmark = false,
  showTagline = false,
  center = false,
  showGlow = true,
  shadowElevation = 4,
  style,
}: BrandLogoProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const isDark = useIsDark();
  const haloSize = iconSize * 1.72;
  const ringColor = 'rgba(255,255,255,0.33)';

  return (
    <View style={[center ? styles.centered : styles.start, style]}>
      <View
        style={{ width: haloSize, height: haloSize, alignItems: 'center', justifyContent: 'center' }}
      >
        {showGlow && (
          <Svg
            pointerEvents="none"
            width={haloSize}
            height={haloSize}
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <RadialGradient id="logoGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.38} />
                <Stop offset="38%" stopColor={colors.tertiary} stopOpacity={0.22} />
                <Stop offset="62%" stopColor={colors.tertiary} stopOpacity={0.08} />
                <Stop offset="100%" stopColor={colors.tertiary} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={haloSize / 2} cy={haloSize / 2} r={haloSize / 2} fill="url(#logoGlow)" />
          </Svg>
        )}
        <View
          style={[
            {
              width: iconSize,
              height: iconSize,
              borderRadius: iconSize / 2,
              borderWidth: 1,
              borderColor: ringColor,
              overflow: 'hidden',
              backgroundColor: colors.surface,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: shadowElevation / 2 },
              shadowOpacity: 0.3,
              shadowRadius: shadowElevation,
              elevation: shadowElevation,
            },
          ]}
        >
          <Image
            source={require('../../../assets/images/icon.png')}
            style={{ width: iconSize, height: iconSize }}
            resizeMode="cover"
          />
        </View>
      </View>
      {showWordmark && (
        <Text
          style={[
            Typography.headlineMedium,
            { color: colors.onBackground, marginTop: 14, textAlign: center ? 'center' : 'left' },
          ]}
        >
          {t('app_name', 'Haserli')}
        </Text>
      )}
      {showTagline && (
        <Text
          style={[
            Typography.bodyMedium,
            {
              color: colors.onSurfaceVariant,
              marginTop: 6,
              textAlign: center ? 'center' : 'left',
            },
          ]}
        >
          {t('brand_tagline', 'Shared list. Smooth errands.')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', justifyContent: 'center' },
  start: { alignItems: 'flex-start', justifyContent: 'center' },
});
