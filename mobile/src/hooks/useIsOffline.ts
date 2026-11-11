import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * True when the device has no usable connection. `isInternetReachable` is null
 * while unknown — only an explicit `false` (or no connection at all) counts, so
 * the app never flashes "offline" on start-up.
 */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setOffline(state.isConnected === false || state.isInternetReachable === false);
      }),
    []
  );
  return offline;
}
