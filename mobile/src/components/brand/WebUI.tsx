import React from 'react';
import { Platform, Pressable, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsDark, useThemeColors, Typography, Layout, BorderRadius } from '../../theme';

/** ── Centered content column with web max-width ─────────────────── */
export function SalinoWebColumn({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.webCol, style]}>
      <View style={styles.webInner}>{children}</View>
    </View>
  );
}

/** Matches Android SalinoSectionTitle (uppercase, bold, letter-spaced). */
export function SalinoSectionTitle({
  text,
  style,
}: {
  text: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  return (
    <Text
      style={[
        {
          fontSize: 13,
          lineHeight: 18,
          fontWeight: '700',
          letterSpacing: 0.7,
          color: colors.onSurfaceVariant,
          paddingHorizontal: 2,
          paddingTop: 14,
          paddingBottom: 10,
          textTransform: 'uppercase',
        } as any,
        style,
      ]}
      numberOfLines={2}
      ellipsizeMode="tail"
    >
      {text}
    </Text>
  );
}

/** Matches Android SalinoWebAppBarTitle (22sp, bold, primary). */
export function SalinoWebAppBarTitle({
  text,
  color,
  style,
}: {
  text: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  return (
    <Text
      numberOfLines={1}
      style={[
        Typography.titleLarge,
        { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.2, color: color ?? colors.primary } as any,
        style,
      ]}
    >
      {text}
    </Text>
  );
}

/** Matches Android SalinoWebInnerTopBar — back button + primary title, transparent. */
export function SalinoWebInnerTopBar({
  title,
  onBack,
  actions,
  style,
}: {
  title: string;
  onBack: () => void;
  actions?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.topBar,
        { paddingTop: insets.top + 4, paddingHorizontal: 4 },
        style,
      ]}
    >
      <Pressable
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [
          styles.topBarBtn,
          { opacity: pressed ? 0.6 : 1, backgroundColor: 'transparent' },
        ]}
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onBackground} />
      </Pressable>
      <View style={{ flex: 1, paddingHorizontal: 4 }}>
        <SalinoWebAppBarTitle text={title} />
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

/** Matches SalinoWebSegmentedTabs — pill row with selected rounded surface. */
export function SalinoWebSegmentedTabs({
  labels,
  selectedIndex,
  onSelect,
}: {
  labels: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.segmentedOuter,
        {
          backgroundColor: colors.surfaceVariant,
          borderRadius: Layout.tabBarCorner,
        },
      ]}
    >
      {labels.map((label, idx) => {
        const selected = idx === selectedIndex;
        return (
          <Pressable
            key={idx}
            onPress={() => onSelect(idx)}
            style={({ pressed }) => [
              styles.segmentedInner,
              {
                backgroundColor: selected ? colors.surface : 'transparent',
                borderRadius: Layout.tabInnerCorner,
                opacity: pressed ? 0.8 : 1,
                shadowColor: '#000',
                shadowOpacity: selected ? 0.08 : 0,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 4,
                elevation: selected ? 2 : 0,
              },
            ]}
          >
            <Text
              style={[
                Typography.labelLarge,
                { fontWeight: '700', color: selected ? colors.primary : colors.onSurfaceVariant } as any,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  webCol: { flex: 1, alignItems: 'center', width: '100%' },
  webInner: {
    width: '100%',
    maxWidth: Layout.maxContentWidth,
    paddingHorizontal: Layout.horizontalPadding,
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
    backgroundColor: 'transparent',
  },
  topBarBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmentedOuter: {
    flexDirection: 'row',
    padding: 4,
    width: '100%',
  },
  segmentedInner: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
