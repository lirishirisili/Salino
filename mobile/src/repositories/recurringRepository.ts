import { Timestamp } from 'firebase/firestore';
import { RecurringItem, ItemCategory, ActivityType } from '../models';
import { subscribeToRecurringItems } from '../remote/firestoreService';
import {
  localUpsertRecurring,
  localDeleteRecurring,
  mergeRemoteRecurring,
} from '../local/storage';
import { auth } from '../remote/firebase';
import { normalizeItemName } from '../utils/textUtils';
import { shoppingRepository } from './shoppingRepository';
import { enqueueUpsert, enqueueDelete, flush } from '../services/syncQueueProcessor';

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function runBackground(work: Promise<unknown>): void {
  work.catch((e) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[recurringRepository] background write failed', e);
    }
  });
}

export const recurringRepository = {
  subscribeToRecurringItems: (
    householdId: string,
    onData: (items: RecurringItem[]) => void,
    onError?: (e: Error) => void
  ) => {
    return subscribeToRecurringItems(
      householdId,
      (remoteItems) => {
        // Protected merge — keep pending local writes intact.
        runBackground(mergeRemoteRecurring(householdId, remoteItems));
        runBackground(flush(householdId));
        onData(remoteItems);
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
      createdAt: now,
      updatedAt: now,
    };

    // Local-first.
    await localUpsertRecurring(householdId, item);
    await enqueueUpsert(householdId, 'RECURRING', item.id);
    runBackground(flush(householdId));

    const activityType = data.id ? ActivityType.RECURRING_UPDATED : ActivityType.RECURRING_CREATED;
    runBackground(shoppingRepository.logActivity(householdId, activityType, item.id, item.name));

    return item;
  },

  deleteRecurringItem: async (householdId: string, itemId: string): Promise<void> => {
    // Local-first — also delete locally (previously only deleted on server).
    await localDeleteRecurring(householdId, itemId);
    await enqueueDelete(householdId, 'RECURRING', itemId);
    runBackground(flush(householdId));
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
    await enqueueUpsert(householdId, 'RECURRING', updated.id);
    runBackground(flush(householdId));
  },
};
