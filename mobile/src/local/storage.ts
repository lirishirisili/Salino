import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShoppingItem, Household, HouseholdMember, ActivityLog, RecurringItem } from '../models';
import {
  encodeItem,
  decodeItem,
  encodeRecurring,
  decodeRecurring,
  encodeActivity,
  decodeActivity,
  encodeHousehold,
  decodeHousehold,
  encodeMember,
  decodeMember,
} from './timestampCodec';

const KEYS = {
  ITEMS: (hId: string) => `@items_${hId}`,
  HOUSEHOLD: (hId: string) => `@household_${hId}`,
  MEMBERS: (hId: string) => `@members_${hId}`,
  ACTIVITY: (hId: string) => `@activity_${hId}`,
  RECURRING: (hId: string) => `@recurring_${hId}`,
  /** @deprecated Global key — cleared on read; use per-user key below. */
  LEGACY_ACTIVE_HOUSEHOLD: '@active_household_id',
  ACTIVE_HOUSEHOLD: (userId: string) => `@active_household_${userId}`,
  PENDING_OPS: (hId: string) => `@pending_ops_${hId}`,
};

export interface PendingSyncOperation {
  id: string;
  householdId: string;
  targetType: 'ITEM' | 'ACTIVITY' | 'RECURRING';
  operationType: 'UPSERT' | 'DELETE';
  targetId: string;
  createdAtMillis: number;
}

// Generic JSON storage helpers
async function getJSON<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

async function setJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

/**
 * Serializes async operations per storage key. Read-modify-write upserts and
 * full-list writes to the same key must not interleave, otherwise concurrent
 * mutations (e.g. checking off several items quickly) can lose writes. This
 * also makes fire-and-forget background writes safe.
 */
const keyLocks = new Map<string, Promise<unknown>>();

function runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = keyLocks.get(key) ?? Promise.resolve();
  const result = prev.then(fn, fn);
  // Keep the chain alive without leaking rejections into it.
  keyLocks.set(key, result.then(NOOP, NOOP));
  return result;
}

const NOOP = () => {};

// Shopping Items
async function readItemsRaw(householdId: string): Promise<ShoppingItem[]> {
  const raw = (await getJSON<Record<string, unknown>[]>(KEYS.ITEMS(householdId))) ?? [];
  return raw.map(decodeItem);
}

async function writeItemsRaw(householdId: string, items: ShoppingItem[]): Promise<void> {
  await setJSON(KEYS.ITEMS(householdId), items.map(encodeItem));
}

export const localGetItems = async (householdId: string): Promise<ShoppingItem[]> => {
  return readItemsRaw(householdId);
};

export const localSetItems = async (householdId: string, items: ShoppingItem[]): Promise<void> => {
  await runExclusive(KEYS.ITEMS(householdId), () => writeItemsRaw(householdId, items));
};

export const localUpsertItem = async (householdId: string, item: ShoppingItem): Promise<void> => {
  await runExclusive(KEYS.ITEMS(householdId), async () => {
    const items = await readItemsRaw(householdId);
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
      items[idx] = item;
    } else {
      items.unshift(item);
    }
    await writeItemsRaw(householdId, items);
  });
};

export const localDeleteItem = async (householdId: string, itemId: string): Promise<void> => {
  await runExclusive(KEYS.ITEMS(householdId), async () => {
    const items = await readItemsRaw(householdId);
    await writeItemsRaw(
      householdId,
      items.filter((i) => i.id !== itemId)
    );
  });
};

// Household
export const localGetHousehold = async (householdId: string): Promise<Household | null> => {
  const raw = await getJSON<Record<string, unknown>>(KEYS.HOUSEHOLD(householdId));
  return raw ? decodeHousehold(raw) : null;
};

export const localSetHousehold = async (household: Household): Promise<void> => {
  await setJSON(KEYS.HOUSEHOLD(household.id), encodeHousehold(household));
};

// Members
export const localGetMembers = async (householdId: string): Promise<HouseholdMember[]> => {
  const raw = (await getJSON<Record<string, unknown>[]>(KEYS.MEMBERS(householdId))) ?? [];
  return raw.map(decodeMember);
};

export const localSetMembers = async (householdId: string, members: HouseholdMember[]): Promise<void> => {
  await setJSON(KEYS.MEMBERS(householdId), members.map(encodeMember));
};

// Activity
async function readActivityRaw(householdId: string): Promise<ActivityLog[]> {
  const raw = (await getJSON<Record<string, unknown>[]>(KEYS.ACTIVITY(householdId))) ?? [];
  return raw.map(decodeActivity);
}

async function writeActivityRaw(householdId: string, logs: ActivityLog[]): Promise<void> {
  await setJSON(KEYS.ACTIVITY(householdId), logs.map(encodeActivity));
}

export const localGetActivity = async (householdId: string): Promise<ActivityLog[]> => {
  return readActivityRaw(householdId);
};

export const localSetActivity = async (householdId: string, logs: ActivityLog[]): Promise<void> => {
  await runExclusive(KEYS.ACTIVITY(householdId), () => writeActivityRaw(householdId, logs));
};

export const localUpsertActivity = async (householdId: string, log: ActivityLog): Promise<void> => {
  await runExclusive(KEYS.ACTIVITY(householdId), async () => {
    const logs = await readActivityRaw(householdId);
    const idx = logs.findIndex((l) => l.id === log.id);
    if (idx >= 0) {
      logs[idx] = log;
    } else {
      logs.unshift(log);
    }
    await writeActivityRaw(householdId, logs);
  });
};

// Recurring Items
async function readRecurringRaw(householdId: string): Promise<RecurringItem[]> {
  const raw = (await getJSON<Record<string, unknown>[]>(KEYS.RECURRING(householdId))) ?? [];
  return raw.map(decodeRecurring);
}

async function writeRecurringRaw(householdId: string, items: RecurringItem[]): Promise<void> {
  await setJSON(KEYS.RECURRING(householdId), items.map(encodeRecurring));
}

export const localGetRecurring = async (householdId: string): Promise<RecurringItem[]> => {
  return readRecurringRaw(householdId);
};

export const localSetRecurring = async (householdId: string, items: RecurringItem[]): Promise<void> => {
  await runExclusive(KEYS.RECURRING(householdId), () => writeRecurringRaw(householdId, items));
};

export const localUpsertRecurring = async (householdId: string, item: RecurringItem): Promise<void> => {
  await runExclusive(KEYS.RECURRING(householdId), async () => {
    const items = await readRecurringRaw(householdId);
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
      items[idx] = item;
    } else {
      items.push(item);
    }
    await writeRecurringRaw(householdId, items);
  });
};

// Active household — scoped per Firebase uid so accounts cannot leak into each other.
export const localGetActiveHouseholdId = async (userId: string): Promise<string | null> => {
  const scoped = await AsyncStorage.getItem(KEYS.ACTIVE_HOUSEHOLD(userId));
  if (scoped) return scoped;
  const legacy = await AsyncStorage.getItem(KEYS.LEGACY_ACTIVE_HOUSEHOLD);
  if (legacy) {
    await AsyncStorage.removeItem(KEYS.LEGACY_ACTIVE_HOUSEHOLD);
  }
  return null;
};

export const localSetActiveHouseholdId = async (userId: string, id: string): Promise<void> => {
  await AsyncStorage.removeItem(KEYS.LEGACY_ACTIVE_HOUSEHOLD);
  await AsyncStorage.setItem(KEYS.ACTIVE_HOUSEHOLD(userId), id);
};

export const localClearActiveHousehold = async (userId: string): Promise<void> => {
  await AsyncStorage.multiRemove([
    KEYS.ACTIVE_HOUSEHOLD(userId),
    KEYS.LEGACY_ACTIVE_HOUSEHOLD,
  ]);
};

// Pending Sync Operations
export const localGetPendingOps = async (householdId: string): Promise<PendingSyncOperation[]> => {
  return (await getJSON<PendingSyncOperation[]>(KEYS.PENDING_OPS(householdId))) ?? [];
};

export const localAddPendingOp = async (op: PendingSyncOperation): Promise<void> => {
  const ops = await localGetPendingOps(op.householdId);
  ops.push(op);
  await setJSON(KEYS.PENDING_OPS(op.householdId), ops);
};

export const localRemovePendingOp = async (householdId: string, opId: string): Promise<void> => {
  const ops = await localGetPendingOps(householdId);
  await setJSON(
    KEYS.PENDING_OPS(householdId),
    ops.filter((o) => o.id !== opId)
  );
};

// Clear all local data for a household
export const localClearHouseholdData = async (householdId: string): Promise<void> => {
  await AsyncStorage.multiRemove([
    KEYS.ITEMS(householdId),
    KEYS.HOUSEHOLD(householdId),
    KEYS.MEMBERS(householdId),
    KEYS.ACTIVITY(householdId),
    KEYS.RECURRING(householdId),
    KEYS.PENDING_OPS(householdId),
  ]);
};

// Keys that must survive sign-out / session resets (per-user prefs, tour, boot flags).
const PRESERVED_ASYNC_PREFIXES = [
  '@onboarding_',
  '@salino/tour_completed',
  '@app_language',
  '@rtl_boot_reload_attempted',
] as const;

function isPreservedAsyncKey(key: string): boolean {
  return PRESERVED_ASYNC_PREFIXES.some((prefix) => key.startsWith(prefix));
}

// Clear everything on sign out
export const localClearAll = async (): Promise<void> => {
  const keys = await AsyncStorage.getAllKeys();
  const appKeys = keys.filter((k) => k.startsWith('@') && !isPreservedAsyncKey(k));
  if (appKeys.length > 0) {
    await AsyncStorage.multiRemove(appKeys);
  }
};
