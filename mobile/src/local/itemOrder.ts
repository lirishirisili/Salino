import { ShoppingItem } from '../models';

function itemSortMillis(item: ShoppingItem): number {
  return item.updatedAt?.toMillis() ?? item.createdAt?.toMillis() ?? 0;
}

/**
 * Newest first — same as Firestore `orderBy('updatedAt', 'desc')`.
 * Cache / Map iteration can be oldest-first; callers must sort before render.
 */
export function sortShoppingItems(items: ShoppingItem[]): ShoppingItem[] {
  return [...items].sort((a, b) => {
    const delta = itemSortMillis(b) - itemSortMillis(a);
    if (delta !== 0) return delta;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
