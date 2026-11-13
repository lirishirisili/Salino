import type { ItemCategory, ShoppingItem } from '../models';
import { normalizeItemName } from './textUtils';

/** Monthly "my basket" summary, computed from the home's bought items. */

export interface InsightsSummary {
  /** Items bought in the month. */
  itemsBought: number;
  /** Distinct days with at least one purchase (≈ shopping trips). */
  shoppingDays: number;
  /** Same numbers for the previous month, for the trend line. */
  prevItemsBought: number;
  prevShoppingDays: number;
  topItems: { name: string; count: number }[];
  categories: { category: ItemCategory; count: number; share: number }[];
  /** Who checked items off the most (only when 2+ people bought). */
  buyers: { name: string; count: number }[];
}

const millis = (item: ShoppingItem): number => item.updatedAt?.toMillis?.() ?? 0;

function monthRange(year: number, month: number): [number, number] {
  return [new Date(year, month, 1).getTime(), new Date(year, month + 1, 1).getTime()];
}

export function computeInsights(boughtItems: ShoppingItem[], now: Date = new Date()): InsightsSummary {
  const [from, to] = monthRange(now.getFullYear(), now.getMonth());
  const [prevFrom, prevTo] = monthRange(now.getFullYear(), now.getMonth() - 1);
  const inMonth = boughtItems.filter((i) => millis(i) >= from && millis(i) < to);
  const inPrev = boughtItems.filter((i) => millis(i) >= prevFrom && millis(i) < prevTo);
  const dayCount = (items: ShoppingItem[]) => new Set(items.map((i) => new Date(millis(i)).toDateString())).size;

  const itemCounts = new Map<string, { name: string; count: number }>();
  const catCounts = new Map<ItemCategory, number>();
  const buyerCounts = new Map<string, number>();
  for (const item of inMonth) {
    const key = item.normalizedName || normalizeItemName(item.name);
    const entry = itemCounts.get(key) ?? { name: item.name.trim(), count: 0 };
    entry.count++;
    itemCounts.set(key, entry);
    catCounts.set(item.category, (catCounts.get(item.category) ?? 0) + 1);
    const buyer = item.boughtByName?.trim();
    if (buyer) buyerCounts.set(buyer, (buyerCounts.get(buyer) ?? 0) + 1);
  }

  const total = inMonth.length || 1;
  return {
    itemsBought: inMonth.length,
    shoppingDays: dayCount(inMonth),
    prevItemsBought: inPrev.length,
    prevShoppingDays: dayCount(inPrev),
    topItems: [...itemCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    categories: [...catCounts.entries()]
      .map(([category, count]) => ({ category, count, share: count / total }))
      .sort((a, b) => b.count - a.count),
    buyers:
      buyerCounts.size >= 2
        ? [...buyerCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
        : [],
  };
}
