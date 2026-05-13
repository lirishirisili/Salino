import { Timestamp } from 'firebase/firestore';
import { RecurringItem, ItemCategory, ActivityType } from '../models';
import {
  subscribeToRecurringItems,
  firestoreUpsertRecurring,
  firestoreDeleteRecurring,
} from '../remote/firestoreService';
import { localSetRecurring, localUpsertRecurring } from '../local/storage';
import { auth } from '../remote/firebase';
import { normalizeItemName } from '../utils/textUtils';
import { shoppingRepository } from './shoppingRepository';

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export const recurringRepository = {
  subscribeToRecurringItems: (
    householdId: string,
    onData: (items: RecurringItem[]) => void,
    onError?: (e: Error) => void
  ) => {
    return subscribeToRecurringItems(
      householdId,
      (items) => {
        localSetRecurring(householdId, items);
        onData(items);
      },
      onError
    );
  },

  upsertRecurringItem: async (
    householdId: string,
    data: {
      id?: string;
      name: string;
      quantity: number;
      unit: string | null;
      category: ItemCategory;
      note: string;
      intervalDays: number;
    }
  ): Promise<RecurringItem> => {
    const now = Timestamp.now();
    const nextDueAt = Timestamp.fromMillis(Date.now() + data.intervalDays * 24 * 60 * 60 * 1000);

    const item: RecurringItem = {
      id: data.id || generateId(),
      householdId,
      name: data.name,
      normalizedName: normalizeItemName(data.name),
      quantity: data.quantity,
      unit: data.unit as RecurringItem['unit'],
      category: data.category,
      note: data.note,
      intervalDays: data.intervalDays,
      enabled: true,
      nextDueAt,
      lastCompletedAt: null,
      createdAt: data.id ? now : now, // Existing items keep their createdAt on server
      updatedAt: now,
    };

    await localUpsertRecurring(householdId, item);
    await firestoreUpsertRecurring(householdId, item);

    const activityType = data.id ? ActivityType.RECURRING_UPDATED : ActivityType.RECURRING_CREATED;
    await shoppingRepository.logActivity(householdId, activityType, item.id, item.name);

    return item;
  },

  deleteRecurringItem: async (householdId: string, itemId: string): Promise<void> => {
    await firestoreDeleteRecurring(householdId, itemId);
  },

  updateNextDueDate: async (
    householdId: string,
    item: RecurringItem,
    completedAtMillis: number
  ): Promise<void> => {
    const nextDueAt = Timestamp.fromMillis(completedAtMillis + item.intervalDays * 24 * 60 * 60 * 1000);
    const updated: RecurringItem = {
      ...item,
      nextDueAt,
      lastCompletedAt: Timestamp.fromMillis(completedAtMillis),
      updatedAt: Timestamp.now(),
    };
    await localUpsertRecurring(householdId, updated);
    await firestoreUpsertRecurring(householdId, updated);
  },
};
