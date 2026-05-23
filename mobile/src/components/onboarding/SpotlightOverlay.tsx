import React, { useEffect } from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Mask, Rect, Circle as SvgCircle } from 'react-native-svg';
import { BorderRadius, Layout, Typography, useThemeColors } from '../../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export interface SpotlightTarget {
  /** Center X of the target element */
  x: number;
  /** Center Y of the target element */
  y: number;
  /** Radius of the spotlight circle */
  radius: number;
}

export interface SpotlightStep {
  target: SpotlightTarget;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  body: string;
  /** Where the tooltip card should appear relative to spotlight */
  tooltipPosition: 'above' | 'below';
}

interface SpotlightOverlayProps {
  steps: SpotlightStep[];
  currentStep: number;
  onNext: () => void;
  onSkip: () => void;
  totalSteps: number;
}

export function SpotlightOverlay({
  steps,
  currentStep,
  onNext,
  onSkip,
  totalSteps,
}: SpotlightOverlayProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const step = steps[currentStep];
  const isLastStep = currentStep === totalSteps - 1;

  // Animated spotlight position
  const spotX = useSharedValue(step.target.x);
  const spotY = useSharedValue(step.target.y);
  const spotR = useSharedValue(step.target.radius);

  // Pulse animation for the ring
  const pulse = useSharedValue(0);

  // Tooltip entrance animation
  const tooltipProgress = useSharedValue(0);

  useEffect(() => {
    // Animate spotlight position to new target
    spotX.value = withSpring(step.target.x, { damping: 18, stiffness: 120 });
    spotY.value = withSpring(step.target.y, { damping: 18, stiffness: 120 });
    spotR.value = withSpring(step.target.radius, { damping: 18, stiffness: 120 });

    // Restart pulse
    pulse.value = 0;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );

    // Animate tooltip in
    tooltipProgress.value = 0;
    tooltipProgress.value = withDelay(
      200,
      withSpring(1, { damping: 16, stiffness: 100 }),
    );
  }, [currentStep]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 0.6, 1], [0.6, 0.2, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.6]) }],
  }));

  const tooltipStyle = useAnimatedStyle(() => ({
    opacity: tooltipProgress.value,
    transform: [
      { translateY: interpolate(tooltipProgress.value, [0, 1], [20, 0]) },
      { scale: interpolate(tooltipProgress.value, [0, 1], [0.95, 1]) },
    ],
  }));

  // Calculate tooltip position
  const tooltipTop = step.tooltipPosition === 'above'
    ? Math.max(60, step.target.y - step.target.radius - 220)
    : step.target.y + step.target.radius + 24;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dark overlay with spotlight cutout */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Svg width={SCREEN_W} height={SCREEN_H} style={StyleSheet.absoluteFill}>
          <Defs>
            <Mask id="spotlightMask">
              <Rect x={0} y={0} width={SCREEN_W} height={SCREEN_H} fill="white" />
              <SvgCircle
                cx={step.target.x}
                cy={step.target.y}
                r={step.target.radius + 4}
                fill="black"
              />
            </Mask>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={SCREEN_W}
            height={SCREEN_H}
            fill="rgba(0,0,0,0.72)"
            mask="url(#spotlightMask)"
          />
        </Svg>

        {/* Pulsing ring around spotlight */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: step.target.x - step.target.radius,
              top: step.target.y - step.target.radius,
              width: step.target.radius * 2,
              height: step.target.radius * 2,
              borderRadius: step.target.radius,
              borderWidth: 2.5,
              borderColor: colors.primary,
            },
            pulseStyle,
          ]}
          pointerEvents="none"
        />

        {/* Static inner ring */}
        <View
          style={{
            position: 'absolute',
            left: step.target.x - step.target.radius - 2,
            top: step.target.y - step.target.radius - 2,
            width: (step.target.radius + 2) * 2,
            height: (step.target.radius + 2) * 2,
            borderRadius: step.target.radius + 2,
            borderWidth: 2,
            borderColor: `${colors.primary}88`,
          }}
          pointerEvents="none"
        />
      </View>

      {/* Tooltip Card */}
      <Animated.View
        style={[
          styles.tooltipContainer,
          { top: tooltipTop },
          tooltipStyle,
        ]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.tooltipCard,
            {
              backgroundColor: colors.surface,
              borderRadius: BorderRadius.large,
              borderWidth: 1,
              borderColor: `${colors.outlineVariant}44`,
              ...Platform.select({
                ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 16 },
                android: { elevation: 12 },
                default: {},
              }),
            },
          ]}
        >
          {/* Step Indicator Dots */}
          <View style={styles.dotsRow}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: i === currentStep ? 20 : 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor:
                      i === currentStep
                        ? colors.primary
                        : i < currentStep
                        ? `${colors.primary}88`
                        : colors.outlineVariant,
                  },
                ]}
              />
            ))}
          </View>

          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer }]}>
            <MaterialCommunityIcons name={step.icon} size={26} color={colors.primary} />
          </View>

          {/* Title */}
          <Text style={[Typography.titleMedium, styles.title, { color: colors.onSurface }]}>
            {step.title}
          </Text>

          {/* Body */}
          <Text style={[Typography.bodyMedium, styles.body, { color: colors.onSurfaceVariant }]}>
            {step.body}
          </Text>

          {/* Actions */}
          <View style={styles.actionsRow}>
            {!isLastStep && (
              <Pressable onPress={onSkip} style={styles.skipButton} hitSlop={8}>
                <Text style={[Typography.labelLarge, { color: colors.outline }]}>
                  {t('onboarding_skip')}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={onNext}
              style={[styles.nextButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[Typography.labelLarge, { color: colors.onPrimary, fontWeight: '700' }]}>
                {isLastStep ? t('onboarding_get_started') : t('onboarding_next')}
              </Text>
              {!isLastStep && (
                <MaterialCommunityIcons name="arrow-right" size={18} color={colors.onPrimary} />
              )}
            </Pressable>
          </View>

          {/* Step counter */}
          <Text style={[Typography.labelSmall, styles.counter, { color: colors.outline }]}>
            {t('onboarding_step_counter', { current: currentStep + 1, total: totalSteps })}
          </Text>
        </View>
      </Animated.View>

      {/* Tap-anywhere catcher (outside tooltip) to advance */}
      <Pressable style={StyleSheet.absoluteFill} onPress={onNext} />
    </View>
  );
}

const styles = StyleSheet.create({
  tooltipContainer: {
    position: 'absolute',
    left: Layout.horizontalPadding,
    right: Layout.horizontalPadding,
    alignItems: 'center',
    zIndex: 10,
  },
  tooltipCard: {
    width: '100%',
    maxWidth: Layout.maxContentWidth - 32,
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  dot: {
    height: 8,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    textAlign: 'center',
    fontWeight: '700',
    marginBottom: 6,
  },
  body: {
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  counter: {
    marginTop: 12,
    textAlign: 'center',
  },
});
