import { Timestamp } from 'firebase/firestore';
import { ShoppingItem, ItemStatus, ActivityType } from '../models';
import {
  subscribeToItems,
  firestoreAddItem,
  firestoreUpdateItem,
  firestoreDeleteItem,
  firestoreLogActivity,
} from '../remote/firestoreService';
import {
  localGetItems,
  localSetItems,
  localUpsertItem,
  localDeleteItem,
} from '../local/storage';
import { auth } from '../remote/firebase';
import { normalizeItemName } from '../utils/textUtils';

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Runs a persistence/remote side-effect off the UI critical path. Mutations
 * return immediately; Firestore's own latency compensation updates the list via
 * the active snapshot listener, so the UI reflects the change without waiting
 * on the full local read-modify-write or the activity-log write.
 */
function runBackground(work: Promise<unknown>): void {
  work.catch((e) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[shoppingRepository] background write failed', e);
    }
  });
}

/**
 * Cheap signature of an items list so we can skip rewriting the full cache blob
 * when a snapshot carries no meaningful change (e.g. pending-write metadata
 * flips). Uses count + newest updatedAt + last id — enough to detect real edits
 * without hashing every field.
 */
function itemsSignature(items: ShoppingItem[]): string {
  let newest = 0;
  for (const item of items) {
    const ms = item.updatedAt?.toMillis?.() ?? item.createdAt?.toMillis?.() ?? 0;
    if (ms > newest) newest = ms;
  }
  const lastId = items.length > 0 ? items[items.length - 1].id : '';
  return `${items.length}:${newest}:${lastId}`;
}

const lastPersistedSignature = new Map<string, string>();

export const shoppingRepository = {
  subscribeToItems: (
    householdId: string,
    onData: (items: ShoppingItem[]) => void,
    onError?: (e: Error) => void
  ) => {
    return subscribeToItems(
      householdId,
      (items) => {
        // Only rewrite the full cache blob when the data actually changed.
        const signature = itemsSignature(items);
        if (lastPersistedSignature.get(householdId) !== signature) {
          lastPersistedSignature.set(householdId, signature);
          runBackground(localSetItems(householdId, items));
        }
        onData(items);
      },
      onError
    );
  },

  getLocalItems: async (householdId: string): Promise<ShoppingItem[]> => {
    return localGetItems(householdId);
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

    // Persist locally for offline durability and write remotely in parallel;
    // the active snapshot listener (latency-compensated) surfaces the new item.
    runBackground(localUpsertItem(householdId, newItem));
    await firestoreAddItem(householdId, newItem);

    // Activity logging is not on the critical path.
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
    runBackground(localUpsertItem(householdId, updated));
    await firestoreUpdateItem(householdId, item.id, updated);
    runBackground(
      shoppingRepository.logActivity(householdId, ActivityType.ITEM_UPDATED, item.id, item.name)
    );
  },

  markAsBought: async (householdId: string, itemId: string, items: ShoppingItem[]): Promise<void> => {
    const uid = auth.currentUser!.uid;
    const displayName = auth.currentUser!.displayName || auth.currentUser!.email?.split('@')[0] || 'User';
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const updated: Partial<ShoppingItem> = {
      status: ItemStatus.BOUGHT,
      boughtBy: uid,
      boughtByName: displayName,
      updatedAt: Timestamp.now(),
    };

    runBackground(localUpsertItem(householdId, { ...item, ...updated } as ShoppingItem));
    await firestoreUpdateItem(householdId, itemId, updated);
    runBackground(
      shoppingRepository.logActivity(householdId, ActivityType.ITEM_BOUGHT, itemId, item.name)
    );
  },

  markAsActive: async (householdId: string, itemId: string, items: ShoppingItem[]): Promise<void> => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const updated: Partial<ShoppingItem> = {
      status: ItemStatus.ACTIVE,
      boughtBy: null,
      boughtByName: null,
      updatedAt: Timestamp.now(),
    };

    runBackground(localUpsertItem(householdId, { ...item, ...updated } as ShoppingItem));
    await firestoreUpdateItem(householdId, itemId, updated);
    runBackground(
      shoppingRepository.logActivity(householdId, ActivityType.ITEM_RESTORED, itemId, item.name)
    );
  },

  deleteItem: async (householdId: string, itemId: string, itemName: string): Promise<void> => {
    runBackground(localDeleteItem(householdId, itemId));
    await firestoreDeleteItem(householdId, itemId);
    runBackground(
      shoppingRepository.logActivity(householdId, ActivityType.ITEM_DELETED, itemId, itemName)
    );
  },

  toggleFavorite: async (householdId: string, item: ShoppingItem): Promise<void> => {
    const updated = { ...item, isFavorite: !item.isFavorite, updatedAt: Timestamp.now() };
    runBackground(localUpsertItem(householdId, updated));
    await firestoreUpdateItem(householdId, item.id, { isFavorite: updated.isFavorite });
  },

  logActivity: async (
    householdId: string,
    type: ActivityType,
    itemId: string,
    itemName: string
  ): Promise<void> => {
    const uid = auth.currentUser!.uid;
    const displayName = auth.currentUser!.displayName || auth.currentUser!.email?.split('@')[0] || 'User';

    const log = {
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

    await firestoreLogActivity(householdId, log);
  },
};
