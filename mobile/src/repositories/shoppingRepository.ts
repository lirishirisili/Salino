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

export const shoppingRepository = {
  subscribeToItems: (
    householdId: string,
    onData: (items: ShoppingItem[]) => void,
    onError?: (e: Error) => void
  ) => {
    return subscribeToItems(
      householdId,
      (items) => {
        localSetItems(householdId, items);
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

    await localUpsertItem(householdId, newItem);
    await firestoreAddItem(householdId, newItem);

    // Log activity
    await shoppingRepository.logActivity(householdId, ActivityType.ITEM_ADDED, newItem.id, newItem.name);

    return newItem;
  },

  updateItem: async (householdId: string, item: ShoppingItem): Promise<void> => {
    const updated = {
      ...item,
      normalizedName: normalizeItemName(item.name),
      updatedAt: Timestamp.now(),
    };
    await localUpsertItem(householdId, updated);
    await firestoreUpdateItem(householdId, item.id, updated);
    await shoppingRepository.logActivity(householdId, ActivityType.ITEM_UPDATED, item.id, item.name);
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

    await localUpsertItem(householdId, { ...item, ...updated } as ShoppingItem);
    await firestoreUpdateItem(householdId, itemId, updated);
    await shoppingRepository.logActivity(householdId, ActivityType.ITEM_BOUGHT, itemId, item.name);
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

    await localUpsertItem(householdId, { ...item, ...updated } as ShoppingItem);
    await firestoreUpdateItem(householdId, itemId, updated);
    await shoppingRepository.logActivity(householdId, ActivityType.ITEM_RESTORED, itemId, item.name);
  },

  deleteItem: async (householdId: string, itemId: string, itemName: string): Promise<void> => {
    await localDeleteItem(householdId, itemId);
    await firestoreDeleteItem(householdId, itemId);
    await shoppingRepository.logActivity(householdId, ActivityType.ITEM_DELETED, itemId, itemName);
  },

  toggleFavorite: async (householdId: string, item: ShoppingItem): Promise<void> => {
    const updated = { ...item, isFavorite: !item.isFavorite, updatedAt: Timestamp.now() };
    await localUpsertItem(householdId, updated);
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
