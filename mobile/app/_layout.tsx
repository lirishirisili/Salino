import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { I18nManager, LogBox, useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LightTheme, DarkTheme } from '../src/theme';
import { initI18n, isRTL, resolveBootLanguage } from '../src/i18n';
import { useAuthStore } from '../src/hooks';
import { LoadingScreen, SalinoGradientBackground } from '../src/components';
import { initMobileAds } from '../src/services/initMobileAds';
import { applyBootRtl } from '../src/boot/applyBootRtl';

LogBox.ignoreLogs(['Setting a timer']);

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const paperTheme = colorScheme === 'dark' ? DarkTheme : LightTheme;
  const [i18nReady, setI18nReady] = useState(false);
  const initialize = useAuthStore((s) => s.initialize);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    initMobileAds();
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const language = await resolveBootLanguage();
        const desiredRTL = isRTL(language);
        const reloaded = await applyBootRtl(desiredRTL);
        if (reloaded || cancelled) {
          return;
        }
        await initI18n();
        if (!cancelled) {
          setI18nReady(true);
        }
      } catch (e) {
        console.error('Boot init error:', e);
        if (!cancelled) {
          setI18nReady(true);
        }
      }
    })();

    const failsafe = setTimeout(() => {
      if (!cancelled) {
        setI18nReady(true);
      }
    }, 12_000);

    return () => {
      cancelled = true;
      clearTimeout(failsafe);
    };
  }, []);

  useEffect(() => {
    if (!i18nReady) return;
    try {
      const unsubscribe = initialize();
      const timeout = setTimeout(() => {
        const state = useAuthStore.getState();
        if (state.isLoading) {
          useAuthStore.setState({ isLoading: false, isSignedIn: false });
        }
      }, 5000);
      return () => {
        clearTimeout(timeout);
        unsubscribe();
      };
    } catch (e: unknown) {
      console.error('Auth init error:', e);
      useAuthStore.setState({ isLoading: false });
    }
  }, [i18nReady]);

  useEffect(() => {
    if (i18nReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [i18nReady]);

  if (!i18nReady || isLoading) {
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
            <Stack.Screen name="household-setup" />
            <Stack.Screen name="(main)" />
          </Stack>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
