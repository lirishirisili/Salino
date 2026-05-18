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

  return (
    <View style={styles.root}>
      <View style={styles.content}>{children}</View>
      {showBanner ? <BottomBannerAd /> : null}
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
