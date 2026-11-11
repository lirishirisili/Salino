import { ShoppingItem } from '../models';

/**
 * Order key: when the item was ADDED. Using `updatedAt` made the list jump —
 * every edit, quantity merge, undo or a partner's change moved the item to the
 * top. The bought section sorts itself by `updatedAt` (most recently bought).
 */
function itemSortMillis(item: ShoppingItem): number {
  return item.createdAt?.toMillis() ?? item.updatedAt?.toMillis() ?? 0;
}

/**
 * Newest-added first, stable across edits.
 * Cache / Map iteration can be oldest-first; callers must sort before render.
 */
export function sortShoppingItems(items: ShoppingItem[]): ShoppingItem[] {
  return [...items].sort((a, b) => {
    const delta = itemSortMillis(b) - itemSortMillis(a);
    if (delta !== 0) return delta;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
