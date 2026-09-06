import { Redirect } from 'expo-router';
import { LoadingScreen } from '../src/components';
import { useSessionRoute } from '../src/hooks/useSessionRoute';

export default function Index() {
  const route = useSessionRoute();

  if (route === 'loading') {
    return <LoadingScreen />;
  }

  if (route === 'auth') {
    return <Redirect href="/auth" />;
  }

  if (route === 'verify-email') {
    return <Redirect href="/verify-email" />;
  }

  if (route === 'main') {
    return <Redirect href="/(main)/shopping-list" />;
  }

  return <Redirect href="/household-setup" />;
}
