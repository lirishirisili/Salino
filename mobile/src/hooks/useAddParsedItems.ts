import { useCallback } from 'react';
import { DuplicateReason, ItemCategory, type ItemUnit, type ShoppingItem } from '../models';
import { findDuplicate } from '../services';
import { useHouseholdStore } from './useHouseholdStore';
import { useShoppingStore } from './useShoppingStore';

export interface ItemToAdd {
  name: string;
  quantity: number;
  unit: ItemUnit | null;
  category: ItemCategory;
  note?: string;
}

export interface AddManyResult {
  /** Newly created items (what Undo removes). */
  added: ShoppingItem[];
  /** Items whose quantity was added to an existing identical item. */
  mergedCount: number;
  /** Removes the newly added items. */
  undo: () => Promise<void>;
}

/**
 * Adds several items at once (pasted list, shared text, "milk, bread, eggs").
 * An exact duplicate of something already on the list merges its quantity
 * instead of creating a second row.
 */
export function useAddParsedItems() {
  const addItem = useShoppingStore((s) => s.addItem);
  const updateItem = useShoppingStore((s) => s.updateItem);
  const deleteItem = useShoppingStore((s) => s.deleteItem);

  return useCallback(
    async (items: ItemToAdd[]): Promise<AddManyResult> => {
      const householdId = useHouseholdStore.getState().activeHouseholdId;
      if (!householdId) throw new Error('NO_HOUSEHOLD');
      const added: ShoppingItem[] = [];
      let mergedCount = 0;
      for (const p of items) {
        const name = p.name.trim();
        if (!name) continue;
        const dup = findDuplicate(name, useShoppingStore.getState().activeItems);
        if (dup && dup.reason === DuplicateReason.EXACT_DUPLICATE) {
          const note = dup.item.note?.trim() ? dup.item.note : (p.note ?? '').trim();
          await updateItem(householdId, {
            ...dup.item,
            quantity: dup.item.quantity + p.quantity,
            note,
          });
          mergedCount += 1;
          continue;
        }
        added.push(
          await addItem(householdId, {
            name,
            quantity: p.quantity,
            unit: p.unit,
            category: p.category ?? ItemCategory.OTHER,
            note: (p.note ?? '').trim(),
            isUrgent: false,
            isFavorite: false,
            boughtBy: null,
            boughtByName: null,
          })
        );
      }
      return {
        added,
        mergedCount,
        undo: async () => {
          for (const item of added) {
            await deleteItem(householdId, item.id, item.name);
          }
        },
      };
    },
    [addItem, deleteItem, updateItem]
  );
}
