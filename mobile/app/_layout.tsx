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
import { SessionRouteGuard } from '../src/session/SessionRouteGuard';
import { getSessionSnapshotSync } from '../src/session/sessionRestore';
import { TourOverlay } from '../src/components/tour/TourOverlay';
import { initLevelPlay } from '../src/services/initLevelPlay';
import { initMobileAnalytics } from '../src/services/initMobileAnalytics';
import { applyBootRtl } from '../src/boot/applyBootRtl';
import { BootErrorBoundary } from '../src/boot/BootErrorBoundary';
import { BootSplashView } from '../src/boot/BootSplashView';
import { subscribeHideNativeSplashOnActive } from '../src/boot/hideNativeSplash';
import { perfMark } from '../src/utils/perf';

LogBox.ignoreLogs(['Setting a timer']);

perfMark('process_start');

// Keep the system splash until the first JS frame. Hide is NOT gated on i18n/auth
// — that coupling left the Android 12 splash up forever after a recents kill.
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
    const sub = subscribeHideNativeSplashOnActive();
    return () => sub.remove();
  }, []);

  useEffect(() => {
    void (async () => {
      // iOS: ATT runs inside initLevelPlay before ads; analytics starts after.
      await initLevelPlay();
      await initMobileAnalytics();
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let authTimeout: ReturnType<typeof setTimeout> | undefined;

    // Start auth listener immediately (in parallel with i18n boot)
    try {
      initialize();
      authTimeout = setTimeout(() => {
        const state = useAuthStore.getState();
        if (!state.isLoading && state.hasBootstrapped && !state.isRestoringSession) {
          return;
        }
        // Timeout: exit splash but do NOT flip isSignedIn to false.
        // If a last-known session exists, keep the user in their house
        // instead of dumping them on login / join-house.
        const snap = getSessionSnapshotSync();
        const householdId = state.lastHouseholdId ?? snap?.householdId ?? null;
        useAuthStore.setState({
          isLoading: false,
          hasBootstrapped: true,
          isRestoringSession: false,
          ...(snap?.uid
            ? {
                isSignedIn: true,
                lastHouseholdId: householdId,
                householdResolution: householdId
                  ? 'has_household'
                  : state.householdResolution,
              }
            : {}),
        });
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
    }, 8_000);

    return () => {
      cancelled = true;
      clearTimeout(failsafe);
      if (authTimeout) clearTimeout(authTimeout);
      // Do not unsubscribe auth — a remount resubscribe can emit a transient
      // null and was the resume path that dumped users onto login / join-house.
    };
  }, []);

  // Only block the whole UI during the INITIAL boot. Once bootstrapped, keep
  // the navigator mounted even if auth re-fires — unmounting remounts the stack
  // and duplicates shopping-list on the Android back stack.
  const showBootGate = !i18nReady || (isLoading && !hasBootstrapped);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BootErrorBoundary>
        <SafeAreaProvider style={{ flex: 1 }}>
          <PaperProvider theme={paperTheme}>
            {showBootGate ? (
              <BootSplashView />
            ) : (
              <View style={{ flex: 1 }}>
                <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} translucent />
                <SessionRouteGuard />
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
            )}
          </PaperProvider>
        </SafeAreaProvider>
      </BootErrorBoundary>
    </GestureHandlerRootView>
  );
}
