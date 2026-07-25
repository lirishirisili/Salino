import React, { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { MainAdBannerHost } from '../../src/components/ads';
import { TourController } from '../../src/components/tour/TourProvider';
import { useTourStore } from '../../src/features/tour';
import {
  useHouseholdStore,
  useShoppingStore,
  useActivityStore,
  useNotificationStore,
} from '../../src/hooks';
import {
  bootstrapNotificationInfrastructure,
  getNotificationPermissionGranted,
  requestPermissionAndRegister,
} from '../../src/services/notificationService';

export const unstable_settings = {
  initialRouteName: 'shopping-list',
};

export default function MainLayout() {
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  const subscribeHousehold = useHouseholdStore((s) => s.subscribe);
  const subscribeShopping = useShoppingStore((s) => s.subscribe);
  const subscribeActivity = useActivityStore((s) => s.subscribe);
  const loadPreferences = useNotificationStore((s) => s.loadPreferences);
  const setPermissionGranted = useNotificationStore((s) => s.setPermissionGranted);
  const tourBootstrapStatus = useTourStore((s) => s.bootstrapStatus);
  const permissionRequestedRef = useRef(false);

  useEffect(() => {
    if (!activeHouseholdId) return;
    const unsubs = [
      subscribeHousehold(activeHouseholdId),
      subscribeShopping(activeHouseholdId),
      subscribeActivity(activeHouseholdId),
    ];
    return () => unsubs.forEach((u) => u());
  }, [activeHouseholdId]);

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
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="shopping-list" />
        <Stack.Screen name="add-item" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="edit-item" />
        <Stack.Screen name="history" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="supermarket-mode" />
        <Stack.Screen name="settings" />
      </Stack>
    </MainAdBannerHost>
  );
}
