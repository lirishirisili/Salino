import AsyncStorage from '@react-native-async-storage/async-storage';

import { TOUR_STORAGE_KEY_PREFIX, WHATS_NEW_ID, WHATS_NEW_STORAGE_KEY_PREFIX } from './config';

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

function whatsNewKey(uid: string): string {
  return `${WHATS_NEW_STORAGE_KEY_PREFIX}_${WHATS_NEW_ID}:${uid}`;
}

const whatsNewSeenCache = new Set<string>();

export async function hasSeenWhatsNew(uid: string): Promise<boolean> {
  if (!uid) return true;
  if (whatsNewSeenCache.has(uid)) return true;
  try {
    const seen = (await AsyncStorage.getItem(whatsNewKey(uid))) === '1';
    if (seen) whatsNewSeenCache.add(uid);
    return seen;
  } catch {
    // Unreadable storage: don't risk showing it on every launch.
    return true;
  }
}

export async function markWhatsNewSeen(uid: string): Promise<void> {
  if (!uid) return;
  whatsNewSeenCache.add(uid);
  try {
    await AsyncStorage.setItem(whatsNewKey(uid), '1');
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
