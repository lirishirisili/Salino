import * as Location from 'expo-location';
import type { GeoPoint } from './types';

export type LocationPermission = 'granted' | 'denied' | 'undetermined';

export async function locationPermission(): Promise<LocationPermission> {
  try {
    const p = await Location.getForegroundPermissionsAsync();
    if (p.granted) return 'granted';
    return p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'denied';
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

export type PositionResult =
  | { kind: 'ok'; point: GeoPoint }
  /** Refused for good: only the system settings can turn it back on. */
  | { kind: 'blocked' }
  | { kind: 'denied' }
  | { kind: 'unavailable' };

/** The shopper's position, used on the device only to pick nearby stores. */
export async function currentPosition(askPermission: boolean): Promise<PositionResult> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && askPermission && perm.canAskAgain) perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return { kind: perm.canAskAgain ? 'denied' : 'blocked' };
    const last = await Location.getLastKnownPositionAsync({ maxAge: 15 * 60 * 1000, requiredAccuracy: 2000 });
    if (last) return { kind: 'ok', point: { lat: last.coords.latitude, lng: last.coords.longitude } };
    const fix = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 12_000);
    return fix ? { kind: 'ok', point: { lat: fix.coords.latitude, lng: fix.coords.longitude } } : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}
