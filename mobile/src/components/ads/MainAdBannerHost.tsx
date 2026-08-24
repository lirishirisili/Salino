import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSegments } from 'expo-router';
import { BottomBannerAd } from './BottomBannerAd';

const BANNER_SCREEN_NAMES = new Set([
  'shopping-list',
  'history',
  'activity',
  'supermarket-mode',
]);

type MainAdBannerHostProps = {
  children: React.ReactNode;
};

/** Stacks main navigation above a bottom banner (in document flow, not overlay). */
export function MainAdBannerHost({ children }: MainAdBannerHostProps) {
  const segments = useSegments();
  const screenName = segments[segments.length - 1];
  const showBanner = BANNER_SCREEN_NAMES.has(screenName);

  console.log(
    `[BANNER] MainAdBannerHost screen=${String(screenName)} ` +
      `showBanner=${showBanner} segments=${segments.join('/')}`,
  );

  // Keep a single banner instance mounted across main navigation and toggle its
  // visibility per route, so Add/Edit/Settings never display an ad and we avoid
  // unmount/remount churn.
  return (
    <View style={styles.root}>
      <View style={styles.content}>{children}</View>
      <BottomBannerAd visible={showBanner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
});
