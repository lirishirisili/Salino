import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShoppingItem, Household, HouseholdMember, ActivityLog, RecurringItem } from '../models';

const KEYS = {
  ITEMS: (hId: string) => `@items_${hId}`,
  HOUSEHOLD: (hId: string) => `@household_${hId}`,
  MEMBERS: (hId: string) => `@members_${hId}`,
  ACTIVITY: (hId: string) => `@activity_${hId}`,
  RECURRING: (hId: string) => `@recurring_${hId}`,
  ACTIVE_HOUSEHOLD: '@active_household_id',
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

// Shopping Items
export const localGetItems = async (householdId: string): Promise<ShoppingItem[]> => {
  return (await getJSON<ShoppingItem[]>(KEYS.ITEMS(householdId))) ?? [];
};

export const localSetItems = async (householdId: string, items: ShoppingItem[]): Promise<void> => {
  await setJSON(KEYS.ITEMS(householdId), items);
};

export const localUpsertItem = async (householdId: string, item: ShoppingItem): Promise<void> => {
  const items = await localGetItems(householdId);
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    items[idx] = item;
  } else {
    items.unshift(item);
  }
  await localSetItems(householdId, items);
};

export const localDeleteItem = async (householdId: string, itemId: string): Promise<void> => {
  const items = await localGetItems(householdId);
  await localSetItems(
    householdId,
    items.filter((i) => i.id !== itemId)
  );
};

// Household
export const localGetHousehold = async (householdId: string): Promise<Household | null> => {
  return getJSON<Household>(KEYS.HOUSEHOLD(householdId));
};

export const localSetHousehold = async (household: Household): Promise<void> => {
  await setJSON(KEYS.HOUSEHOLD(household.id), household);
};

// Members
export const localGetMembers = async (householdId: string): Promise<HouseholdMember[]> => {
  return (await getJSON<HouseholdMember[]>(KEYS.MEMBERS(householdId))) ?? [];
};

export const localSetMembers = async (householdId: string, members: HouseholdMember[]): Promise<void> => {
  await setJSON(KEYS.MEMBERS(householdId), members);
};

// Activity
export const localGetActivity = async (householdId: string): Promise<ActivityLog[]> => {
  return (await getJSON<ActivityLog[]>(KEYS.ACTIVITY(householdId))) ?? [];
};

export const localSetActivity = async (householdId: string, logs: ActivityLog[]): Promise<void> => {
  await setJSON(KEYS.ACTIVITY(householdId), logs);
};

export const localUpsertActivity = async (householdId: string, log: ActivityLog): Promise<void> => {
  const logs = await localGetActivity(householdId);
  const idx = logs.findIndex((l) => l.id === log.id);
  if (idx >= 0) {
    logs[idx] = log;
  } else {
    logs.unshift(log);
  }
  await localSetActivity(householdId, logs);
};

// Recurring Items
export const localGetRecurring = async (householdId: string): Promise<RecurringItem[]> => {
  return (await getJSON<RecurringItem[]>(KEYS.RECURRING(householdId))) ?? [];
};

export const localSetRecurring = async (householdId: string, items: RecurringItem[]): Promise<void> => {
  await setJSON(KEYS.RECURRING(householdId), items);
};

export const localUpsertRecurring = async (householdId: string, item: RecurringItem): Promise<void> => {
  const items = await localGetRecurring(householdId);
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    items[idx] = item;
  } else {
    items.push(item);
  }
  await localSetRecurring(householdId, items);
};

// Active Household
export const localGetActiveHouseholdId = async (): Promise<string | null> => {
  return AsyncStorage.getItem(KEYS.ACTIVE_HOUSEHOLD);
};

export const localSetActiveHouseholdId = async (id: string): Promise<void> => {
  await AsyncStorage.setItem(KEYS.ACTIVE_HOUSEHOLD, id);
};

export const localClearActiveHousehold = async (): Promise<void> => {
  await AsyncStorage.removeItem(KEYS.ACTIVE_HOUSEHOLD);
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

// Clear everything on sign out
export const localClearAll = async (): Promise<void> => {
  const keys = await AsyncStorage.getAllKeys();
  const appKeys = keys.filter((k) => k.startsWith('@'));
  if (appKeys.length > 0) {
    await AsyncStorage.multiRemove(appKeys);
  }
};
