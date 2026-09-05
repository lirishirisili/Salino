import React, { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { MainAdBannerHost } from '../../src/components/ads';
import { TourController } from '../../src/components/tour/TourProvider';
import { useTourStore } from '../../src/features/tour';
import {
  useHouseholdStore,
  useShoppingStore,
  useNotificationStore,
} from '../../src/hooks';
import {
  bootstrapNotificationInfrastructure,
  getNotificationPermissionGranted,
  requestPermissionAndRegister,
} from '../../src/services/notificationService';
import { flush as flushSyncQueue } from '../../src/services/syncQueueProcessor';

export const unstable_settings = {
  initialRouteName: 'shopping-list',
};

export default function MainLayout() {
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  const subscribeHousehold = useHouseholdStore((s) => s.subscribe);
  const subscribeShopping = useShoppingStore((s) => s.subscribe);
  const loadPreferences = useNotificationStore((s) => s.loadPreferences);
  const setPermissionGranted = useNotificationStore((s) => s.setPermissionGranted);
  const tourBootstrapStatus = useTourStore((s) => s.bootstrapStatus);
  const permissionRequestedRef = useRef(false);

  // Incremented when the app returns to foreground so the subscription effect
  // tears down stale Firestore listeners and re-registers fresh ones — mirrors
  // native ProcessLifecycleOwner ON_START → forceRefreshSync().
  const [foregroundKey, setForegroundKey] = useState(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (
        next === 'active' &&
        appStateRef.current.match(/inactive|background/)
      ) {
        setForegroundKey((k) => k + 1);
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!activeHouseholdId) return;
    // The activity feed listener is intentionally NOT started here; it is
    // subscribed only while the activity screen is mounted to keep it off the
    // cold-start critical path.
    // Flush any pending offline ops on foreground / re-subscribe.
    flushSyncQueue(activeHouseholdId).catch(() => {});

    const unsubs = [
      subscribeHousehold(activeHouseholdId),
      subscribeShopping(activeHouseholdId),
    ];
    return () => unsubs.forEach((u) => u());
  }, [activeHouseholdId, foregroundKey]);

  // Channel + listeners only — never show the OS permission dialog here.
  useEffect(() => {
    void bootstrapNotificationInfrastructure();
    void loadPreferences();
    // Reflect current OS permission immediately (before any prompt).
    void getNotificationPermissionGranted().then(setPermissionGranted);
  }, [loadPreferences, setPermissionGranted]);

  // Ask for notification permission only after the post-login tour has settled
  // (completed previously, finished/skipped, or disabled).
  useEffect(() => {
    if (tourBootstrapStatus !== 'done' || permissionRequestedRef.current) return;
    permissionRequestedRef.current = true;
    let cancelled = false;
    (async () => {
      // OS permission only — FCM register failures must not clear the UI flag.
      const granted = await requestPermissionAndRegister();
      if (!cancelled) setPermissionGranted(granted);
    })();
    return () => {
      cancelled = true;
    };
  }, [tourBootstrapStatus, setPermissionGranted]);

  return (
    <MainAdBannerHost>
      <TourController />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          // Match Kotlin NavHost defaults (fade), not horizontal slide.
          animation: 'fade',
        }}
      >
        <Stack.Screen name="shopping-list" />
        <Stack.Screen name="add-item" options={{ animation: 'fade' }} />
        <Stack.Screen name="edit-item" />
        <Stack.Screen name="history" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="supermarket-mode" />
        <Stack.Screen name="settings" />
      </Stack>
    </MainAdBannerHost>
  );
}
