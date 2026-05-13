import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useHouseholdStore, useShoppingStore, useActivityStore } from '../../src/hooks';

export default function MainLayout() {
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  const subscribeHousehold = useHouseholdStore((s) => s.subscribe);
  const subscribeShopping = useShoppingStore((s) => s.subscribe);
  const subscribeActivity = useActivityStore((s) => s.subscribe);

  useEffect(() => {
    if (!activeHouseholdId) return;
    const unsubs = [
      subscribeHousehold(activeHouseholdId),
      subscribeShopping(activeHouseholdId),
      subscribeActivity(activeHouseholdId),
    ];
    return () => unsubs.forEach((u) => u());
  }, [activeHouseholdId]);

  return (
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
  );
}
