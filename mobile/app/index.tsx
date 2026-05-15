import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/hooks';
import { LoadingScreen } from '../src/components';

export default function Index() {
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const isLoading = useAuthStore((s) => s.isLoading);
  const profile = useAuthStore((s) => s.profile);

  if (!isSignedIn) {
    return <Redirect href="/auth" />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (profile?.activeHouseholdId) {
    return <Redirect href="/(main)/shopping-list" />;
  }

  return <Redirect href="/household-setup" />;
}
