import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../theme';
import { APPODEAL_BANNER_RESERVED_HEIGHT } from '../../config/appodeal';
import { SalinoGradientBackground } from '../brand';
import { BottomBannerAd } from './BottomBannerAd';

type MainAdBannerHostProps = {
  children: React.ReactNode;
};

/**
 * Content on the gradient; banner in a dedicated strip below (outside absoluteFill
 * glow layers so Appodeal is not covered and FABs stay above the ad).
 */
export function MainAdBannerHost({ children }: MainAdBannerHostProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const bannerStripHeight = APPODEAL_BANNER_RESERVED_HEIGHT + insets.bottom;

  return (
    <View style={styles.root}>
      <SalinoGradientBackground style={styles.content}>{children}</SalinoGradientBackground>
      <View
        style={[
          styles.bannerStrip,
          {
            height: bannerStripHeight,
            paddingBottom: insets.bottom,
            backgroundColor: colors.background,
          },
        ]}
      >
        <BottomBannerAd visible />
      </View>
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
  bannerStrip: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
});
