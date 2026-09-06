import { useEffect } from 'react';
import { router, usePathname } from 'expo-router';
import { useSessionRoute } from '../hooks/useSessionRoute';
import { isRecoverableAuthPath } from './sessionRouting';

/**
 * Safety net: if a resume race lands on login / join-house while we still have
 * a house, bounce back immediately. Does not pull the user off main screens.
 */
export function SessionRouteGuard() {
  const pathname = usePathname();
  const route = useSessionRoute();

  useEffect(() => {
    if (route !== 'main') return;
    if (!isRecoverableAuthPath(pathname)) return;
    router.replace('/(main)/shopping-list');
  }, [route, pathname]);

  return null;
}
