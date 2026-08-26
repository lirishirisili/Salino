import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { LogBox, useColorScheme, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LightTheme, DarkTheme } from '../src/theme';
import { initI18n, isRTL, resolveBootLanguage } from '../src/i18n';
import { useAuthStore, useInviteDeepLinkListener } from '../src/hooks';
import { LoadingScreen, SalinoGradientBackground } from '../src/components';
import { TourOverlay } from '../src/components/tour/TourOverlay';
import { initLevelPlay } from '../src/services/initLevelPlay';
import { initMobileAnalytics } from '../src/services/initMobileAnalytics';
import { applyBootRtl } from '../src/boot/applyBootRtl';
import { perfMark } from '../src/utils/perf';

LogBox.ignoreLogs(['Setting a timer']);

perfMark('process_start');

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const paperTheme = colorScheme === 'dark' ? DarkTheme : LightTheme;
  const [i18nReady, setI18nReady] = useState(false);
  const initialize = useAuthStore((s) => s.initialize);
  const isLoading = useAuthStore((s) => s.isLoading);
  const hasBootstrapped = useAuthStore((s) => s.hasBootstrapped);

  useInviteDeepLinkListener();

  useEffect(() => {
    void (async () => {
      // iOS: ATT runs inside initLevelPlay before ads; analytics starts after.
      await initLevelPlay();
      await initMobileAnalytics();
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let authUnsubscribe: (() => void) | undefined;
    let authTimeout: ReturnType<typeof setTimeout> | undefined;

    // Start auth listener immediately (in parallel with i18n boot)
    try {
      authUnsubscribe = initialize();
      authTimeout = setTimeout(() => {
        const state = useAuthStore.getState();
        if (state.isLoading) {
          useAuthStore.setState({
            isLoading: false,
            isSignedIn: false,
            hasBootstrapped: true,
          });
        }
      }, 8000);
    } catch (e: unknown) {
      console.error('Auth init error:', e);
      useAuthStore.setState({ isLoading: false, hasBootstrapped: true });
    }

    (async () => {
      try {
        const language = await resolveBootLanguage();
        const desiredRTL = isRTL(language);
        const reloaded = await applyBootRtl(desiredRTL);
        if (cancelled) return;
        if (reloaded) {
          // Reload was triggered for RTL; finish boot after a short wait.
          setTimeout(() => {
            void (async () => {
              if (cancelled) return;
              try { await initI18n(); } catch (e) { console.error('Boot init error after RTL reload:', e); }
              if (!cancelled) setI18nReady(true);
            })();
          }, 2500);
          return;
        }
        await initI18n();
        if (!cancelled) setI18nReady(true);
      } catch (e) {
        console.error('Boot init error:', e);
        if (!cancelled) setI18nReady(true);
      }
    })();

    const failsafe = setTimeout(() => {
      if (!cancelled) setI18nReady(true);
    }, 12_000);

    return () => {
      cancelled = true;
      clearTimeout(failsafe);
      if (authTimeout) clearTimeout(authTimeout);
      if (authUnsubscribe) authUnsubscribe();
    };
  }, []);

  useEffect(() => {
    if (i18nReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [i18nReady]);

  // Only block the whole UI during the INITIAL boot. Once bootstrapped, keep
  // the navigator mounted even if auth re-fires — unmounting remounts the stack
  // and duplicates shopping-list on the Android back stack.
  if (!i18nReady || (isLoading && !hasBootstrapped)) {
    return (
      <SafeAreaProvider style={{ flex: 1 }}>
        <PaperProvider theme={paperTheme}>
          <SalinoGradientBackground style={{ flex: 1 }}>
            <LoadingScreen />
          </SalinoGradientBackground>
        </PaperProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <View style={{ flex: 1 }}>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} translucent />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: 'transparent' },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="join/[inviteCode]" options={{ animation: 'none' }} />
              <Stack.Screen name="household-setup" />
              <Stack.Screen name="(main)" />
            </Stack>
            <TourOverlay />
          </View>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
