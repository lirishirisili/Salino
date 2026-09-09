import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SalinoGradientBackground } from '../brand';
import { BottomBannerAd } from './BottomBannerAd';

type MainAdBannerHostProps = {
  children: React.ReactNode;
};

/**
 * Stacks main navigation above a bottom banner (in document flow, not overlay).
 * The shared SalinoGradientBackground wraps both content and banner so the ad
 * sits on the same glow layer as Kotlin's transparent Scaffold.
 *
 * One banner instance stays mounted for the whole (main) stack so every
 * authenticated screen (list, supermarket, history, activity, settings,
 * add/edit item) shows the same bottom ad without remount churn.
 */
export function MainAdBannerHost({ children }: MainAdBannerHostProps) {
  return (
    <SalinoGradientBackground style={styles.root}>
      <View style={styles.content}>{children}</View>
      <BottomBannerAd visible />
    </SalinoGradientBackground>
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
