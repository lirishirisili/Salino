import AsyncStorage from '@react-native-async-storage/async-storage';

import { TOUR_STORAGE_KEY_PREFIX } from './config';

/** In-memory cache so completion survives remounts before AsyncStorage finishes writing. */
const completedUidCache = new Set<string>();

export function tourStorageKey(uid: string): string {
  return `${TOUR_STORAGE_KEY_PREFIX}:${uid}`;
}

export async function hasCompletedTour(uid: string): Promise<boolean> {
  if (!uid) return false;
  if (completedUidCache.has(uid)) return true;
  try {
    const value = await AsyncStorage.getItem(tourStorageKey(uid));
    const done = value === '1';
    if (done) completedUidCache.add(uid);
    return done;
  } catch {
    return completedUidCache.has(uid);
  }
}

export async function markTourCompleted(uid: string): Promise<void> {
  if (!uid) return;
  completedUidCache.add(uid);
  try {
    await AsyncStorage.setItem(tourStorageKey(uid), '1');
  } catch {
    // Non-critical — in-memory cache still prevents repeat in this session.
  }
}

export async function clearTourCompleted(uid: string): Promise<void> {
  if (!uid) return;
  completedUidCache.delete(uid);
  try {
    await AsyncStorage.removeItem(tourStorageKey(uid));
  } catch {
    // ignore
  }
}
