import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { DevSettings, I18nManager, LogBox, useColorScheme } from 'react-native';
import * as Updates from 'expo-updates';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LightTheme, DarkTheme } from '../src/theme';
import { initI18n, isRTL, resolveBootLanguage } from '../src/i18n';
import { useAuthStore } from '../src/hooks';
import { LoadingScreen, SalinoGradientBackground } from '../src/components';

LogBox.ignoreLogs(['Setting a timer']);

// Reload the JS bundle so that I18nManager.forceRTL() actually takes effect on
// already-rendered RN views. Without this, the first launch in Hebrew renders
// LTR until the user navigates away from the initial screen and back.
const reloadForRTL = async () => {
  if (__DEV__) {
    DevSettings.reload();
    return;
  }
  try {
    await Updates.reloadAsync();
  } catch {
    DevSettings.reload();
  }
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const paperTheme = colorScheme === 'dark' ? DarkTheme : LightTheme;
  const [i18nReady, setI18nReady] = useState(false);
  const initialize = useAuthStore((s) => s.initialize);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    (async () => {
      try {
        // First decide if a hard JS reload is required to align RTL state.
        const language = await resolveBootLanguage();
        const desiredRTL = isRTL(language);
        if (I18nManager.isRTL !== desiredRTL) {
          I18nManager.allowRTL(desiredRTL);
          I18nManager.forceRTL(desiredRTL);
          await reloadForRTL();
          return; // App is reloading; skip further setup.
        }
        await initI18n();
        setI18nReady(true);
      } catch (e) {
        console.error('i18n init error:', e);
        setI18nReady(true);
      }
    })();
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
    } catch (e: any) {
      console.error('Auth init error:', e);
      useAuthStore.setState({ isLoading: false });
    }
  }, [i18nReady]);

  if (!i18nReady || isLoading) {
    return (
      <SafeAreaProvider>
        <PaperProvider theme={paperTheme}>
          <SalinoGradientBackground>
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
