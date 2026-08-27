import React, { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
  PixelRatio,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Blur,
  Canvas,
  Circle,
  Group,
  Paint,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';
import Svg, { Circle as SvgCircle, Defs, RadialGradient as SvgRadial, Stop } from 'react-native-svg';
import { useThemeColors } from '../../theme';

interface SalinoGradientBackgroundProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * When true, render children only (no gradient/glows). Used when a parent
   * already provides SalinoGradientBackground (e.g. MainAdBannerHost).
   */
  plain?: boolean;
}

/** Compose applies Modifier.blur(20.dp) only on API 31+ (BrandComponents.kt). */
const USE_COMPOSE_BLUR =
  Platform.OS === 'android' ? Number(Platform.Version) >= 31 : Platform.OS === 'ios';

/**
 * Android RenderEffect blur radius is in px; Skia Blur uses sigma ≈ radius/2
 * for a comparable soft falloff to Compose's Modifier.blur(20.dp).
 */
const BLUR_SIGMA = (20 * PixelRatio.get()) / 2;

type GlowBlob = {
  cx: number;
  cy: number;
  r: number;
  color: string;
};

/**
 * Mirrors Android SalinoGradientBackground (BrandComponents.kt) 1:1:
 *  - vertical 5-stop gradient (bg → soft → bg → soft → bg), sharp
 *  - five radial glow blobs (2-stop core → transparent) with Compose positions
 *  - blur(20.dp) on the glow layer only when API ≥ 31 / iOS
 */
export function SalinoGradientBackground({
  children,
  style,
  plain = false,
}: SalinoGradientBackgroundProps) {
  const colors = useThemeColors();
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) {
      setSize({ w: width, h: height });
    }
  };

  const blobs: GlowBlob[] = useMemo(() => {
    const { w, h } = size;
    if (w <= 0 || h <= 0) return [];
    return [
      { cx: -w * 0.1, cy: -h * 0.02, r: w * 0.42, color: colors.glowMint },
      { cx: w * 1.1, cy: h * 0.04, r: w * 0.4, color: colors.glowPeach },
      { cx: -w * 0.08, cy: h * 0.55, r: w * 0.34, color: colors.glowPeach },
      { cx: w * 1.08, cy: h * 0.42, r: w * 0.36, color: colors.glowMint },
      { cx: w * 0.5, cy: h * 1.02, r: w * 0.32, color: colors.glowMint },
    ];
  }, [size, colors.glowMint, colors.glowPeach]);

  if (plain) {
    return <View style={[styles.fill, style]}>{children}</View>;
  }

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
      {blobs.length > 0 &&
        (USE_COMPOSE_BLUR ? (
          <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
            <Group
              layer={
                <Paint>
                  <Blur blur={BLUR_SIGMA} mode="clamp" />
                </Paint>
              }
            >
              {blobs.map((b, i) => (
                <Circle key={i} cx={b.cx} cy={b.cy} r={b.r}>
                  <RadialGradient
                    c={vec(b.cx, b.cy)}
                    r={b.r}
                    colors={[b.color, 'transparent']}
                  />
                </Circle>
              ))}
            </Group>
          </Canvas>
        ) : (
          // Compose API < 31: same blobs, no blur.
          <Svg
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            width={size.w}
            height={size.h}
          >
            <Defs>
              <SvgRadial id="mint" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <Stop offset="0%" stopColor={colors.glowMint} stopOpacity={1} />
                <Stop offset="100%" stopColor={colors.glowMint} stopOpacity={0} />
              </SvgRadial>
              <SvgRadial id="peach" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <Stop offset="0%" stopColor={colors.glowPeach} stopOpacity={1} />
                <Stop offset="100%" stopColor={colors.glowPeach} stopOpacity={0} />
              </SvgRadial>
            </Defs>
            {blobs.map((b, i) => (
              <SvgCircle
                key={i}
                cx={b.cx}
                cy={b.cy}
                r={b.r}
                fill={b.color === colors.glowMint ? 'url(#mint)' : 'url(#peach)'}
              />
            ))}
          </Svg>
        ))}
      <View style={styles.fill} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
