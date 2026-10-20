import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getDebugAdLoadState,
  initAppodeal,
  showDebugInterstitial,
  showDebugRewarded,
  subscribeAppodealReady,
} from '../../services/initAppodeal';
import { Spacing, Typography, useThemeColors } from '../../theme';
import { isNativeDebuggableBuild } from '../../utils/isNativeDebuggableBuild';
import { SalinoSurfaceCard } from '../brand';

/**
 * Temporary Appodeal onboarding helper — native DEBUG builds only.
 * Uses BuildConfig.DEBUG (not `__DEV__`) because this project embeds JS
 * in debug APKs with production Metro flags.
 */
export function AppodealDebugAdPanel() {
  if (!isNativeDebuggableBuild()) {
    return null;
  }

  return <AppodealDebugAdPanelInner />;
}

function AppodealDebugAdPanelInner() {
  const colors = useThemeColors();
  const [ready, setReady] = useState(false);
  const [interstitialLoaded, setInterstitialLoaded] = useState(false);
  const [rewardedLoaded, setRewardedLoaded] = useState(false);
  const [lastAction, setLastAction] = useState<string>('');

  const refresh = useCallback(() => {
    const state = getDebugAdLoadState();
    setReady(state.ready);
    setInterstitialLoaded(state.interstitialLoaded);
    setRewardedLoaded(state.rewardedLoaded);
  }, []);

  useEffect(() => {
    void initAppodeal();
    const unsub = subscribeAppodealReady(() => {
      refresh();
    });
    refresh();
    const id = setInterval(refresh, 1500);
    return () => {
      unsub();
      clearInterval(id);
    };
  }, [refresh]);

  const onInterstitial = () => {
    const shown = showDebugInterstitial();
    setLastAction(
      shown
        ? 'Interstitial show() invoked — check logcat'
        : 'Interstitial not loaded yet — wait / tap again',
    );
    refresh();
  };

  const onRewarded = () => {
    const shown = showDebugRewarded();
    setLastAction(
      shown
        ? 'Rewarded show() invoked — check logcat'
        : 'Rewarded not loaded yet — wait / tap again',
    );
    refresh();
  };

  return (
    <SalinoSurfaceCard>
      <Text style={[Typography.titleMedium, { color: colors.primary }]}>
        Appodeal DEBUG ads
      </Text>
      <Text style={[Typography.bodySmall, styles.meta, { color: colors.onSurfaceVariant }]}>
        Temporary onboarding panel — native DEBUG APK only (not RELEASE).
      </Text>
      <Text style={[Typography.bodySmall, { color: colors.onSurface }]}>
        SDK ready: {ready ? 'yes' : 'no'}
      </Text>
      <Text style={[Typography.bodySmall, { color: colors.onSurface }]}>
        Interstitial loaded: {interstitialLoaded ? 'yes' : 'no'}
      </Text>
      <Text style={[Typography.bodySmall, { color: colors.onSurface }]}>
        Rewarded loaded: {rewardedLoaded ? 'yes' : 'no'}
      </Text>
      {lastAction ? (
        <Text style={[Typography.bodySmall, styles.meta, { color: colors.onSurfaceVariant }]}>
          {lastAction}
        </Text>
      ) : null}

      <View style={styles.row}>
        <Pressable
          onPress={onInterstitial}
          disabled={!interstitialLoaded}
          accessibilityRole="button"
          accessibilityState={{ disabled: !interstitialLoaded }}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: colors.primary,
              opacity: !interstitialLoaded ? 0.4 : pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text style={[Typography.labelLarge, { color: colors.onPrimary }]}>
            Show Test Interstitial
          </Text>
        </Pressable>
        <Pressable
          onPress={onRewarded}
          disabled={!rewardedLoaded}
          accessibilityRole="button"
          accessibilityState={{ disabled: !rewardedLoaded }}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: colors.secondary,
              opacity: !rewardedLoaded ? 0.4 : pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text style={[Typography.labelLarge, { color: colors.onPrimary }]}>
            Show Test Rewarded
          </Text>
        </Pressable>
      </View>
    </SalinoSurfaceCard>
  );
}

const styles = StyleSheet.create({
  meta: {
    marginTop: 4,
    marginBottom: 8,
  },
  row: {
    marginTop: Spacing.md,
    gap: 10,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
});
