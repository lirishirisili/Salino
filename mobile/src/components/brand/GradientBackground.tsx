import React, { useState } from 'react';
import {
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useThemeColors } from '../../theme';

interface SalinoGradientBackgroundProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Mirrors Android SalinoGradientBackground (BrandComponents.kt):
 *  - vertical 5-stop gradient (bg → soft → bg → soft → bg)
 *  - five soft radial glow blobs in mint / peach with pixel-accurate positions:
 *      glow(Offset(-w*0.10, -h*0.02), w*0.42, mint)
 *      glow(Offset( w*1.10,  h*0.04), w*0.40, peach)
 *      glow(Offset(-w*0.08,  h*0.55), w*0.34, peach)
 *      glow(Offset( w*1.08,  h*0.42), w*0.36, mint)
 *      glow(Offset( w*0.50,  h*1.02), w*0.32, mint)
 */
export function SalinoGradientBackground({ children, style }: SalinoGradientBackgroundProps) {
  const colors = useThemeColors();
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) {
      setSize({ w: width, h: height });
    }
  };

  return (
    <View
      style={[styles.fill, { backgroundColor: colors.background }, style]}
      onLayout={onLayout}
    >
      <LinearGradient
        colors={[
          colors.background,
          colors.surfaceSoft,
          colors.background,
          colors.surfaceSoft,
          colors.background,
        ]}
        locations={[0, 0.25, 0.5, 0.75, 1]}
        style={StyleSheet.absoluteFill}
      />
      {size.w > 0 && size.h > 0 && (
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width={size.w}
          height={size.h}
        >
          <Defs>
            <RadialGradient id="mint" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <Stop offset="0%" stopColor={colors.glowMint} stopOpacity={1} />
              <Stop offset="100%" stopColor={colors.glowMint} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="peach" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <Stop offset="0%" stopColor={colors.glowPeach} stopOpacity={1} />
              <Stop offset="100%" stopColor={colors.glowPeach} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle
            cx={-size.w * 0.1}
            cy={-size.h * 0.02}
            r={size.w * 0.42}
            fill="url(#mint)"
          />
          <Circle
            cx={size.w * 1.1}
            cy={size.h * 0.04}
            r={size.w * 0.4}
            fill="url(#peach)"
          />
          <Circle
            cx={-size.w * 0.08}
            cy={size.h * 0.55}
            r={size.w * 0.34}
            fill="url(#peach)"
          />
          <Circle
            cx={size.w * 1.08}
            cy={size.h * 0.42}
            r={size.w * 0.36}
            fill="url(#mint)"
          />
          <Circle
            cx={size.w * 0.5}
            cy={size.h * 1.02}
            r={size.w * 0.32}
            fill="url(#mint)"
          />
        </Svg>
      )}
      <View style={styles.fill}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
