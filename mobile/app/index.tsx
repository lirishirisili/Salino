import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore, useHouseholdStore } from '../src/hooks';
import { LoadingScreen } from '../src/components';

export default function Index() {
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const profile = useAuthStore((s) => s.profile);
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId);
  const loadActiveHousehold = useHouseholdStore((s) => s.loadActiveHousehold);

  useEffect(() => {
    if (isSignedIn) {
      loadActiveHousehold();
    }
  }, [isSignedIn]);

  if (!isSignedIn) {
    return <Redirect href="/auth" />;
  }

  if (profile?.activeHouseholdId || activeHouseholdId) {
    return <Redirect href="/(main)/shopping-list" />;
  }

  return <Redirect href="/household-setup" />;
}
