import React from 'react';
import { ActivityIndicator, Image, StyleSheet, useColorScheme, View } from 'react-native';

/**
 * First-paint boot UI. Must not use i18n, Paper, Skia, or any hook that can
 * suspend — this tree has to commit so splash-hide effects can run after a
 * process death / recents swipe.
 */
export function BootSplashView() {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  return (
    <View style={[styles.fill, { backgroundColor: dark ? '#111318' : '#F6F9F8' }]}>
      <Image
        source={require('../../assets/images/icon.png')}
        style={styles.logo}
        resizeMode="cover"
      />
      <ActivityIndicator size="large" color={dark ? '#5FD9CC' : '#0D9488'} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 20,
  },
  spinner: {
    marginTop: 24,
  },
});
