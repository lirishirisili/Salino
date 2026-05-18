import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/hooks';
import { LoadingScreen } from '../src/components';

export default function Index() {
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const isLoading = useAuthStore((s) => s.isLoading);
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);

  if (!isSignedIn) {
    return <Redirect href="/auth" />;
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  // Require email verification for email/password users
  if (user && !user.emailVerified && user.providerData?.[0]?.providerId === 'password') {
    return <Redirect href="/verify-email" />;
  }

  if (profile?.activeHouseholdId) {
    return <Redirect href="/(main)/shopping-list" />;
  }

  return <Redirect href="/household-setup" />;
}
