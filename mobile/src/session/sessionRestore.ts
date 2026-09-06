import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../remote/firebase';

/** Survives `localClearAll` so a mistaken session wipe can still recover. */
export const SESSION_RESTORE_KEY = '@session_restore';

export type SessionSnapshot = {
  uid: string;
  householdId: string | null;
  updatedAt: number;
};

let memory: SessionSnapshot | null = null;
let explicitSignOut = false;

export function beginExplicitSignOut(): void {
  explicitSignOut = true;
}

export function endExplicitSignOut(): void {
  explicitSignOut = false;
}

export function isExplicitSignOut(): boolean {
  return explicitSignOut;
}

export function getSessionSnapshotSync(): SessionSnapshot | null {
  return memory;
}

const ACTIVE_HOUSEHOLD_PREFIX = '@active_household_';
const LEGACY_ACTIVE_HOUSEHOLD = '@active_household_id';

/**
 * First launch after this session layer ships has no `@session_restore` yet,
 * but the per-user household key is already on disk. Rebuild a snapshot from
 * that so a resume-null cannot be treated as a logged-out user.
 */
export async function recoverSnapshotFromHouseholdCache(): Promise<SessionSnapshot | null> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const houseKey = keys.find(
      (key) => key.startsWith(ACTIVE_HOUSEHOLD_PREFIX) && key !== LEGACY_ACTIVE_HOUSEHOLD
    );
    if (!houseKey) return null;
    const uid = houseKey.slice(ACTIVE_HOUSEHOLD_PREFIX.length);
    const householdId = await AsyncStorage.getItem(houseKey);
    if (!uid || !householdId) return null;
    return { uid, householdId, updatedAt: Date.now() };
  } catch {
    return null;
  }
}

export async function loadSessionSnapshot(): Promise<SessionSnapshot | null> {
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(SESSION_RESTORE_KEY);
    if (!raw) {
      const recovered = await recoverSnapshotFromHouseholdCache();
      if (recovered) {
        await persistSessionSnapshot(recovered);
        return recovered;
      }
      return null;
    }
    const parsed = JSON.parse(raw) as SessionSnapshot;
    if (!parsed?.uid || typeof parsed.uid !== 'string') return null;
    memory = {
      uid: parsed.uid,
      householdId: parsed.householdId ?? null,
      updatedAt: parsed.updatedAt ?? 0,
    };
    return memory;
  } catch {
    return null;
  }
}

export async function persistSessionSnapshot(next: SessionSnapshot): Promise<void> {
  memory = next;
  await AsyncStorage.setItem(SESSION_RESTORE_KEY, JSON.stringify(next));
}

export async function rememberSessionUser(uid: string): Promise<void> {
  const prev = await loadSessionSnapshot();
  await persistSessionSnapshot({
    uid,
    householdId: prev?.uid === uid ? prev.householdId : null,
    updatedAt: Date.now(),
  });
}

export async function rememberSessionHousehold(householdId: string | null): Promise<void> {
  const prev = await loadSessionSnapshot();
  const uid = prev?.uid ?? auth.currentUser?.uid ?? null;
  if (!uid) return;
  await persistSessionSnapshot({
    uid,
    householdId,
    updatedAt: Date.now(),
  });
}

export async function clearSessionSnapshot(): Promise<void> {
  memory = null;
  await AsyncStorage.removeItem(SESSION_RESTORE_KEY);
}

/** Test-only: reset module state between cases. */
export function __resetSessionRestoreForTests(): void {
  memory = null;
  explicitSignOut = false;
}
