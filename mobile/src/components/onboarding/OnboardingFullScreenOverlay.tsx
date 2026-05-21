import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  children: React.ReactNode;
}

/** Dimmed full-screen host — matches Android OnboardingFullScreenOverlay. */
export function OnboardingFullScreenOverlay({ children }: Props) {
  return <View style={styles.overlay}>{children}</View>;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
