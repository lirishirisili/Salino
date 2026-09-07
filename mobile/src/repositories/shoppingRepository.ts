import { Timestamp } from 'firebase/firestore';
import { ShoppingItem, RecurringItem, ItemStatus, ActivityType, ActivityLog } from '../models';
import { subscribeToItems } from '../remote/firestoreService';
import {
  localGetItems,
  localUpsertItem,
  localDeleteItem,
  localUpsertActivity,
  mergeRemoteItems,
} from '../local/storage';
import { auth } from '../remote/firebase';
import { normalizeItemName } from '../utils/textUtils';
import { enqueueUpsert, enqueueDelete, flush } from '../services/syncQueueProcessor';
import { sortShoppingItems } from '../local/itemOrder';

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Runs a persistence/remote side-effect off the UI critical path.
 */
function runBackground(work: Promise<unknown>): void {
  work.catch((e) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[shoppingRepository] background write failed', e);
    }
  });
}

export const shoppingRepository = {
  subscribeToItems: (
    householdId: string,
    onData: (items: ShoppingItem[]) => void,
    onError?: (e: Error) => void
  ) => {
    return subscribeToItems(
      householdId,
      async (remoteItems) => {
        // Protected merge — keep local pending writes intact.
        runBackground(mergeRemoteItems(householdId, remoteItems));
        // Try flushing any pending ops while online.
        runBackground(flush(householdId));

        // For Zustand we still pass the remote items directly — they reflect
        // the authoritative server state. Pending local writes are already in
        // the store via optimistic updates.
        onData(remoteItems);
      },
      onError
    );
  },

  getLocalItems: async (householdId: string): Promise<ShoppingItem[]> => {
    return sortShoppingItems(await localGetItems(householdId));
  },

  addItem: async (householdId: string, item: Omit<ShoppingItem, 'id' | 'addedBy' | 'addedByName' | 'status' | 'createdAt' | 'updatedAt' | 'normalizedName'>): Promise<ShoppingItem> => {
    const uid = auth.currentUser!.uid;
    const displayName = auth.currentUser!.displayName || auth.currentUser!.email?.split('@')[0] || 'User';
    const now = Timestamp.now();

    const newItem: ShoppingItem = {
      id: generateId(),
      name: item.name,
      normalizedName: normalizeItemName(item.name),
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      note: item.note,
      status: ItemStatus.ACTIVE,
      addedBy: uid,
      addedByName: displayName,
      boughtBy: null,
      boughtByName: null,
      isFavorite: item.isFavorite,
      isUrgent: item.isUrgent,
      createdAt: now,
      updatedAt: now,
    };

    // Local-first: write local → enqueue → flush in background.
    await localUpsertItem(householdId, newItem);
    await enqueueUpsert(householdId, 'ITEM', newItem.id);
    runBackground(flush(householdId));

    // Activity logging — local-first too.
    runBackground(
      shoppingRepository.logActivity(householdId, ActivityType.ITEM_ADDED, newItem.id, newItem.name)
    );

    return newItem;
  },

  updateItem: async (householdId: string, item: ShoppingItem): Promise<void> => {
    const updated = {
      ...item,
      normalizedName: normalizeItemName(item.name),
      updatedAt: Timestamp.now(),
    };
    await localUpsertItem(householdId, updated);
    await enqueueUpsert(householdId, 'ITEM', item.id);
    runBackground(flush(householdId));
    runBackground(
      shoppingRepository.logActivity(householdId, ActivityType.ITEM_UPDATED, item.id, item.name)
    );
  },

  markAsBought: async (
    householdId: string,
    itemId: string,
    items: ShoppingItem[],
    recurringItems?: RecurringItem[],
  ): Promise<void> => {
    const uid = auth.currentUser!.uid;
    const displayName = auth.currentUser!.displayName || auth.currentUser!.email?.split('@')[0] || 'User';
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const boughtAt = Date.now();
    const boughtItem: ShoppingItem = {
      ...item,
      status: ItemStatus.BOUGHT,
      boughtBy: uid,
      boughtByName: displayName,
      updatedAt: Timestamp.now(),
    };

    await localUpsertItem(householdId, boughtItem);
    await enqueueUpsert(householdId, 'ITEM', itemId);
    runBackground(flush(householdId));
    runBackground(
      shoppingRepository.logActivity(householdId, ActivityType.ITEM_BOUGHT, itemId, item.name)
    );

    // Advance matching recurring item schedule — mirrors native behaviour.
    if (recurringItems?.length) {
      const normalizedBought = normalizeItemName(item.name);
      const match = recurringItems.find(
        (r) => r.normalizedName === normalizedBought,
      );
      if (match) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { recurringRepository } = require('./recurringRepository') as typeof import('./recurringRepository');
        runBackground(
          recurringRepository.updateNextDueDate(householdId, match, boughtAt),
        );
      }
    }
  },

  markAsActive: async (householdId: string, itemId: string, items: ShoppingItem[]): Promise<void> => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const activeItem: ShoppingItem = {
      ...item,
      status: ItemStatus.ACTIVE,
      boughtBy: null,
      boughtByName: null,
      updatedAt: Timestamp.now(),
    };

    await localUpsertItem(householdId, activeItem);
    await enqueueUpsert(householdId, 'ITEM', itemId);
    runBackground(flush(householdId));
    runBackground(
      shoppingRepository.logActivity(householdId, ActivityType.ITEM_RESTORED, itemId, item.name)
    );
  },

  deleteItem: async (householdId: string, itemId: string, itemName: string): Promise<void> => {
    await localDeleteItem(householdId, itemId);
    await enqueueDelete(householdId, 'ITEM', itemId);
    runBackground(flush(householdId));
    runBackground(
      shoppingRepository.logActivity(householdId, ActivityType.ITEM_DELETED, itemId, itemName)
    );
  },

  toggleFavorite: async (householdId: string, item: ShoppingItem): Promise<void> => {
    const updated = { ...item, isFavorite: !item.isFavorite, updatedAt: Timestamp.now() };
    await localUpsertItem(householdId, updated);
    await enqueueUpsert(householdId, 'ITEM', item.id);
    runBackground(flush(householdId));
  },

  logActivity: async (
    householdId: string,
    type: ActivityType,
    itemId: string,
    itemName: string,
  ): Promise<void> => {
    const uid = auth.currentUser!.uid;
    const displayName = auth.currentUser!.displayName || auth.currentUser!.email?.split('@')[0] || 'User';

    const log: ActivityLog = {
      id: generateId(),
      householdId,
      type,
      itemId,
      itemName,
      actorUserId: uid,
      actorDisplayName: displayName,
      message: '',
      createdAt: Timestamp.now(),
    };

    // Local-first activity log.
    await localUpsertActivity(householdId, log);
    await enqueueUpsert(householdId, 'ACTIVITY', log.id);
    runBackground(flush(householdId));
  },
};
